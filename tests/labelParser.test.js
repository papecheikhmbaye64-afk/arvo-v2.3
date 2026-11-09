import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLabel } from '../src/lib/labelParser.js';

// Une ligne lue par l'OCR : les mots partagent la même hauteur de caractères et la même confiance.
const L = (text, h = 40, conf = 90) => ({ text, conf, height: h, words: text.split(' ').map((w) => ({ text: w, conf, height: h })) });
const parse = (lines, currency = 'XOF') => parseLabel({ lines }, { currency });
const sel = (r) => r.prices.find((p) => p.id === r.priceId);

test('étiquette simple : nom et prix principal lus, présélectionnés', () => {
  const r = parse([L('Riz parfumé 5 kg', 50), L('4 250 FCFA', 120)]);
  assert.equal(r.status, 'ok');
  assert.equal(r.name, 'Riz parfumé 5 kg');
  assert.equal(sel(r).minor, 4250);
  assert.equal(sel(r).currency, 'XOF');
});

test('le poids et le volume du nom ne sont jamais pris pour un prix', () => {
  const r = parse([L('Huile arachide 1 L', 60), L('1 850 F', 110)]);
  assert.deepEqual(r.prices.map((p) => p.minor), [1850]);
  const r2 = parse([L('Eau minérale 6 x 1,5 L', 60), L('2 100 F', 110)]);
  assert.deepEqual(r2.prices.map((p) => p.minor), [2100]);
});

test('prix au kilo ou au litre : jamais présélectionné face à un prix principal', () => {
  const r = parse([L('Lait demi-écrémé 1 L', 50), L('1,29 €', 120), L('Prix au litre : 1,29 €/L', 25)], 'EUR');
  assert.equal(sel(r).minor, 129);
  assert.equal(sel(r).kind, 'main');
  assert.deepEqual(r.prices.map((p) => p.kind), ['main', 'unit']);
  // seul un prix au kilo : proposé, mais l'utilisateur choisit
  const kg = parse([L('Tomates', 60), L('800 F / kg', 100)]);
  assert.equal(kg.priceId, null);
  assert.equal(kg.prices[0].kind, 'unit');
  assert.equal(kg.status, 'partial');
});

test('promotion : l\'ancien prix est écarté, le prix promo est proposé', () => {
  const r = parse([L('PROMO', 60), L('Sucre en poudre 1 kg', 45), L('1 990 F', 130), L('au lieu de 2 500 F', 28), L('-20%', 40)]);
  assert.equal(sel(r).minor, 1990);
  assert.equal(sel(r).promo, true);
  assert.ok(!r.prices.some((p) => p.minor === 2500));
});

test('code-barres, référence, date, pourcentage et année ne sont pas des prix', () => {
  const r = parse([L('Savon de Marseille', 50), L('6 111 245 330 123', 30), L('Réf. 458921', 25), L('DLC 12/11/2026', 25), L('Lot 2026', 25), L('2 450 F', 100)]);
  assert.deepEqual(r.prices.map((p) => p.minor), [2450]);
  assert.equal(r.status, 'ok');
});

test('deux prix de taille comparable : rien n\'est présélectionné, les deux sont proposés', () => {
  const r = parse([L('Yaourt nature', 50), L('850 F', 90), L('Les 6 : 4 900 F', 85)]);
  assert.equal(r.priceId, null);
  assert.equal(r.status, 'partial');
  assert.deepEqual(r.prices.map((p) => p.minor).sort((a, b) => a - b), [850, 4900]);
});

test('prix nettement plus grand que le second : présélectionné', () => {
  const r = parse([L('Café moulu', 50), L('3 200 F', 130), L('1 600 F', 50)]);
  assert.equal(sel(r).minor, 3200);
});

test('devises : symbole détecté, décimales exactes, jamais de décimales inventées en FCFA', () => {
  assert.equal(sel(parse([L('Pain de mie', 50), L('2,49 €', 110)], 'EUR')).currency, 'EUR');
  const usd = parse([L('Peanut butter', 50), L('$3.49', 110)], 'USD');
  assert.equal(sel(usd).minor, 349);
  // décimales sans devise reconnue alors que la liste est en FCFA : pas un prix fiable
  assert.equal(parse([L('Riz', 50), L('1,29', 110)]).prices.length, 0);
  assert.equal(sel(parse([L('Thé vert', 50), L('2 500 XOF', 110)])).currency, 'XOF');
});

test('nom : majuscules adoucies, mesures conservées, prix retirés de la ligne', () => {
  const r = parse([L('HUILE D\'ARACHIDE 1L', 70), L('1 850 F CFA', 120)]);
  assert.equal(r.name, 'Huile d\'arachide 1 L');
  const mixed = parse([L('Riz Thai 2 300 F', 70)]);
  assert.equal(mixed.name, 'Riz Thai');
  assert.equal(sel(mixed).minor, 2300);
});

test('nom : deux lignes (marque et produit) : l\'autre lecture est proposée', () => {
  const r = parse([L('LESIEUR', 60), L('Huile végétale 5 L', 55), L('9 500 FCFA', 120)]);
  assert.ok(r.name === 'Lesieur' || r.name === 'Huile végétale 5 L');
  assert.equal(r.nameAlternatives.length, 1);
});

test('lecture incertaine : jamais devinée (nom peu fiable non prérempli, prix peu fiable écarté)', () => {
  const r = parse([L('Rjz parfurné', 50, 41), L('4 250 F', 120, 38)]);
  assert.equal(r.name, '');
  assert.equal(r.prices.length, 0);
  assert.equal(r.status, 'partial');
  assert.deepEqual(r.nameAlternatives, ['Rjz parfurné']);   // proposé, jamais écrit à la place de l'utilisateur
});

test('échec : rien d\'exploitable', () => {
  assert.equal(parse([]).status, 'fail');
  assert.equal(parse([L('~ . ,', 30, 20), L('|| 7', 20, 15)]).status, 'fail');
  assert.equal(parseLabel(undefined, { currency: 'XOF' }).status, 'fail');
});

test('lignes sans mots détaillés : la hauteur de ligne sert de repli', () => {
  const r = parse([{ text: 'Spaghetti 500 g', conf: 88, height: 50 }, { text: '650 F', conf: 90, height: 120 }]);
  assert.equal(r.name, 'Spaghetti 500 g');
  assert.equal(sel(r).minor, 650);
});

test('nom coupé (commence par une minuscule) : jamais prérempli, proposé comme texte lu', () => {
  const r = parse([L('eille 300 g', 40), L('2 450 F', 120)]);
  assert.equal(r.name, '');
  assert.equal(r.status, 'partial');
  assert.ok(r.nameAlternatives.includes('eille 300 g'));
  assert.equal(sel(r).minor, 2450);
  // un nom entier en majuscules ou en casse de phrase reste accepté
  assert.equal(parse([L("HUILE D'ARACHIDE 1 L", 50), L('1 850 F', 120)]).name, "Huile d'arachide 1 L");
});

test('nom : une lettre isolée en fin de ligne est du bruit, une unité (g, L) est conservée', () => {
  assert.equal(parse([L('Tomates fraîches h', 50), L('800 F', 120)]).name, 'Tomates fraîches');
  assert.equal(parse([L('Café moulu 250 g', 50), L('3 200 F', 120)]).name, 'Café moulu 250 g');
  assert.equal(parse([L('Huile arachide 1 L', 50), L('1 850 F', 120)]).name, 'Huile arachide 1 L');
});
