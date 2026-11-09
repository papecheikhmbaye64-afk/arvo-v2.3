import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus } from '../src/lib/budget.js';
import { load, DEFAULTS } from '../src/lib/storage.js';

test('jauge : seuils exacts vert / orange / rouge', () => {
  assert.equal(budgetStatus(0, 1000).level, 'ok');
  assert.equal(budgetStatus(799, 1000).level, 'ok');
  assert.equal(budgetStatus(800, 1000).level, 'warn');
  assert.equal(budgetStatus(1000, 1000).level, 'warn');
  assert.equal(budgetStatus(1001, 1000).level, 'over');
});

test('jauge : pas de dérive flottante sur les seuils (0,1 + 0,2)', () => {
  assert.equal(budgetStatus(30, 100).level, 'ok');
  assert.equal(budgetStatus(80, 100).level, 'warn');
  assert.equal(budgetStatus(7, 10).level, 'ok');
  assert.equal(budgetStatus(8, 10).level, 'warn');
});

test('jauge : remplissage plafonné à 100 %, montant du dépassement conservé', () => {
  const s = budgetStatus(1500, 1000);
  assert.equal(s.fill, 1);
  assert.equal(s.pct, 150);
  assert.equal(s.over, 500);
  assert.equal(budgetStatus(500, 1000).fill, 0.5);
  assert.equal(budgetStatus(500, 1000).over, 0);
});

test('jauge : sans budget, rien à afficher', () => {
  for (const b of [0, null, undefined, -5]) {
    const s = budgetStatus(1234, b);
    assert.deepEqual([s.fill, s.pct, s.level, s.over], [0, 0, 'ok', 0]);
  }
});

test('stockage : budget absent ou invalide retombe à 0', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(DEFAULTS.budget, 0);
  assert.equal(load().budget, 0);
  for (const bad of ['x', -3, 1.5, null, 1e30]) {
    store.set('tempo.v2', JSON.stringify({ items: [], budget: bad }));
    assert.equal(load().budget, 0, String(bad));
  }
  store.set('tempo.v2', JSON.stringify({ items: [], budget: 250000 }));
  assert.equal(load().budget, 250000);
});
