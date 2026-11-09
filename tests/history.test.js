import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHistory, makeEntry, entryToItems, monthlySeries, percentChange, suggest, normName } from '../src/lib/history.js';

const at = (y, m, d = 10) => new Date(y, m, d, 12).getTime();
const entry = (id, when, items, currency = 'XOF') => ({ id, at: when, currency, budget: 0, items, totalMinor: items.reduce((t, i) => t + i.priceMinor * i.qty, 0) });
const it = (name, priceMinor, qty = 1) => ({ name, priceMinor, qty, cat: 'other' });
const noRate = () => null;

test('historique : archivage fige la liste, ignore la liste vide', () => {
  const state = { currency: 'XOF', budget: 20000, items: [{ id: 'a', name: 'Riz', priceMinor: 500, qty: 3, done: true, cat: 'pantry' }, { id: 'b', name: 'Lait', priceMinor: 1200, qty: 1, done: false, cat: 'dairy' }] };
  const e = makeEntry(state, 'h1', 1000);
  assert.equal(e.totalMinor, 500 * 3 + 1200);
  assert.deepEqual(e.items[0], { name: 'Riz', priceMinor: 500, qty: 3, cat: 'pantry' });
  assert.equal(e.budget, 20000);
  assert.equal(makeEntry({ ...state, items: [] }, 'h2', 1), null);
});

test('historique : données relues validées, entrées illisibles ignorées, total recalculé', () => {
  assert.deepEqual(sanitizeHistory(undefined), []);
  assert.deepEqual(sanitizeHistory('x'), []);
  const ok = entry('1', at(2026, 10), [it('Riz', 500, 2)]);
  const out = sanitizeHistory([ok, null, { id: 2 }, { ...ok, id: '3', currency: 'xof' }, { ...ok, id: '4', items: [{ name: '', priceMinor: 1, qty: 1 }] }, { ...ok, id: '5', totalMinor: 999999, items: [it('Lait', 100, 150)] }]);
  assert.deepEqual(out.map((e) => e.id), ['1', '5']);
  assert.equal(out[1].totalMinor, 100 * 99);   // quantité plafonnée à 99, total recalculé
});

test('duplication : nouveaux identifiants, rien de coché, conversion de devise ou refus sans taux', () => {
  const e = entry('1', 1, [it('Riz', 65596, 2)], 'XOF');
  let n = 0;
  const same = entryToItems(e, 'XOF', noRate, () => `id${++n}`);
  assert.deepEqual(same.map((i) => [i.id, i.done, i.priceMinor, i.qty]), [['id1', false, 65596, 2]]);
  assert.equal(entryToItems(e, 'EUR', noRate, () => 'x'), null);
  const eur = entryToItems(e, 'EUR', () => 1 / 655.957, () => 'x');
  assert.equal(eur[0].priceMinor, 10000);      // 65 596 FCFA ≈ 100,00 € = 10 000 centimes
});

test('tableau de bord : totaux par mois, fenêtre de 6 mois, devises converties ou comptées à part', () => {
  const now = at(2026, 10, 8); // novembre 2026
  const h = [
    entry('a', at(2026, 10, 2), [it('Riz', 1000)]),
    entry('b', at(2026, 10, 5), [it('Lait', 500, 2)]),
    entry('c', at(2026, 9, 20), [it('Huile', 3000)]),
    entry('d', at(2026, 4, 1), [it('Trop ancien', 9999)]),   // hors fenêtre
    entry('e', at(2026, 10, 6), [it('Pain', 100)], 'EUR')
  ];
  const r = monthlySeries(h, { currency: 'XOF', rate: (a, b) => (a === 'EUR' && b === 'XOF' ? 655.957 : null), now });
  assert.equal(r.series.length, 6);
  const nov = r.series[5], oct = r.series[4];
  assert.equal(nov.month, 10); assert.equal(nov.year, 2026);
  assert.equal(nov.totalMinor, 1000 + 1000 + 656);   // 1,00 € = 655,957 FCFA, arrondi à 656
  assert.equal(nov.count, 3); assert.equal(oct.totalMinor, 3000);
  assert.equal(r.converted, 1); assert.equal(r.skipped, 0);
  const none = monthlySeries(h, { currency: 'XOF', rate: noRate, now });
  assert.equal(none.skipped, 1); assert.equal(none.series[5].totalMinor, 2000);
  // passage d'année
  const jan = monthlySeries([entry('f', at(2025, 11, 25), [it('x', 1)])], { currency: 'XOF', rate: noRate, now: at(2026, 0, 3) });
  assert.deepEqual(jan.series.map((s) => s.month), [7, 8, 9, 10, 11, 0]);
  assert.equal(jan.series[4].totalMinor, 1);
});

test('variation : entière, absente si le mois précédent est vide', () => {
  assert.equal(percentChange(1120, 1000), 12);
  assert.equal(percentChange(920, 1000), -8);
  assert.equal(percentChange(0, 1000), -100);
  assert.equal(percentChange(500, 0), null);
});

test('suggestions : accents ignorés, commence-par d’abord, fréquence, dernier prix, exclusion des articles déjà listés', () => {
  const h = [
    entry('1', 100, [it('Riz parfumé', 800), it('Lait', 700)]),
    entry('2', 200, [it('Riz parfumé', 900), it('Prix du riz', 100), it('Éponge', 300)]),
    entry('3', 300, [it('Riz basmati', 1500)])
  ];
  const s = suggest(h, 'riz', { currency: 'XOF', rate: noRate });
  assert.deepEqual(s.map((x) => x.name), ['Riz parfumé', 'Riz basmati', 'Prix du riz']);
  assert.equal(s[0].priceMinor, 900);          // dernier prix payé
  assert.equal(suggest(h, 'eponge', { currency: 'XOF', rate: noRate })[0].name, 'Éponge');
  assert.deepEqual(suggest(h, 'riz', { currency: 'XOF', rate: noRate, exclude: ['riz parfumé'] }).map((x) => x.name), ['Riz basmati', 'Prix du riz']);
  assert.deepEqual(suggest(h, '  ', { currency: 'XOF', rate: noRate }), []);
  assert.equal(suggest(h, 'riz', { currency: 'XOF', rate: noRate, limit: 1 }).length, 1);
  // prix d'une autre devise sans taux : inconnu (0), jamais inventé
  const eur = suggest([entry('9', 1, [it('Café', 250)], 'EUR')], 'caf', { currency: 'XOF', rate: noRate });
  assert.equal(eur[0].priceMinor, 0);
  assert.equal(normName('  Éponge  Verte '), 'eponge verte');
});

test('compatibilité : anciennes données sans historique se chargent, historique conservé à la relecture', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
  const { load, save } = await import('../src/lib/storage.js');
  m.set('tempo.v2', JSON.stringify({ items: [{ id: 'a', name: 'Riz', priceMinor: 500, qty: 2, done: false, cat: 'pantry' }], currency: 'XOF', budget: 10000 }));
  const old = load();
  assert.deepEqual(old.history, []);
  assert.equal(old.items.length, 1); assert.equal(old.budget, 10000);
  const next = { ...old, history: [entry('h', at(2026, 10), [it('Riz', 500, 2)])] };
  save(next);
  const back = load();
  assert.equal(back.history.length, 1); assert.equal(back.history[0].totalMinor, 1000);
  assert.equal(back.items.length, 1);
});
