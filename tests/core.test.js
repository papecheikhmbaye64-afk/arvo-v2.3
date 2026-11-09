import test from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, formatMinor, convertMinor, formatAmountInput, minorToInput } from '../src/lib/money.js';
import { createFx } from '../src/lib/fx.js';
import { guessCategory } from '../src/lib/categories.js';
import { itemsTotal } from '../src/lib/storage.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('prix : saisie décimale exacte et refus des entrées invalides', () => {
  assert.equal(toMinor('1.250', 'XOF'), 1250);
  assert.equal(toMinor('2,49', 'EUR'), 249);
  assert.equal(toMinor('0,1', 'EUR') + toMinor('0,2', 'EUR'), 30);
  for (const bad of ['abc', '-3', '1e3', '1,2,3']) assert.equal(toMinor(bad, 'EUR'), null, bad);
});

test('total : somme exacte prix × quantité', () => {
  const items = [{ priceMinor: 249, qty: 3 }, { priceMinor: 1099, qty: 1 }, { priceMinor: 0, qty: 5 }];
  assert.equal(itemsTotal(items), 249 * 3 + 1099);
  assert.equal(itemsTotal([]), 0);
});

test('affichage : espaces insécables, devise après le montant', () => {
  assert.equal(formatMinor(1250000, 'XOF'), '1 250 000 FCFA');
  assert.equal(formatMinor(1999, 'EUR'), '19,99 €');
});

test('saisie guidée : milliers ajoutés, décimales limitées par devise', () => {
  assert.equal(formatAmountInput('1234567', 'XOF').text, '1.234.567');
  assert.equal(formatAmountInput('12,345', 'EUR').text, '12,34');
  assert.equal(formatAmountInput('12,', 'XOF').text, '12'); // pas de virgule pour une devise sans décimale
  assert.equal(minorToInput(125000, 'XOF'), '125000');
});

test('devises : parité CFA/euro exacte, même sans réseau', () => {
  const fx = createFx({ fetchImpl: async () => { throw new Error('offline'); }, storage: mem() });
  assert.equal(fx.rate('EUR', 'XOF'), 655.957);
  assert.equal(fx.rate('XOF', 'XAF'), 1);
  assert.ok(Math.abs(fx.rate('XOF', 'EUR') - 1 / 655.957) < 1e-12);
  assert.equal(convertMinor(655957, 'XOF', 'EUR', fx.rate('XOF', 'EUR')), 100000); // 655 957 FCFA = 1 000,00 €
  assert.equal(fx.rate('USD', 'EUR'), null); // aucun taux inventé sans données
});

test('devises : taux réels, cache puis repli sur le dernier relevé', async () => {
  const body = { result: 'success', time_last_update_unix: 1760000000, rates: { USD: 1, EUR: 0.9, GBP: 0.8 } };
  const st = mem(); let t = 1e6;
  const fx = createFx({ fetchImpl: async () => ({ ok: true, json: async () => body }), storage: st, now: () => t });
  await fx.refresh();
  assert.ok(Math.abs(fx.rate('EUR', 'GBP') - 0.8 / 0.9) < 1e-12);
  t += 7 * 3600e3;
  const down = createFx({ fetchImpl: async () => ({ ok: false, status: 503 }), storage: st, now: () => t });
  await down.refresh();
  assert.equal(down.state.stale, true);
  assert.ok(down.rate('EUR', 'GBP') > 0);
});

test('rayons : reconnaissance par mots entiers', () => {
  assert.equal(guessCategory('Tomates cerises'), 'produce');
  assert.equal(guessCategory('Baguette'), 'bakery');
  assert.equal(guessCategory('Lait entier'), 'dairy');
  assert.equal(guessCategory('Poulet fermier'), 'meat');
  assert.equal(guessCategory('Riz parfumé'), 'pantry');
  assert.equal(guessCategory('Eau gazeuse'), 'drinks');
  assert.equal(guessCategory('Gâteau au chocolat'), 'bakery');   // « eau » dans « gâteau » ne déclenche pas les boissons
  assert.equal(guessCategory('Liquide vaisselle'), 'home');
  assert.equal(guessCategory('Truc'), 'other');
  assert.equal(guessCategory('Jus d’orange'), 'drinks');
  assert.equal(guessCategory('Eau de javel'), 'home');
  assert.equal(guessCategory('Tomate concentrée'), 'pantry');
  assert.equal(guessCategory('Lait en poudre'), 'pantry');
  assert.equal(guessCategory('Sardines en boîte'), 'pantry');
});
