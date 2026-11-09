import test from 'node:test';
import assert from 'node:assert/strict';
import { toLines, enhance } from '../src/lib/ocr.js';

const sym = (x1) => ({ bbox: { x1 } });
const word = (text, x0, y0, x1, y1, confidence) => ({ text, confidence, bbox: { x0, y0, x1, y1 }, symbols: [...text].map((_, i) => sym(x0 + (i + 1) * ((x1 - x0) / text.length))) });

test('lecture -> lignes : mots avec hauteur, confiance, position ; texte vide ignoré', () => {
  const data = { blocks: [{ paragraphs: [{ lines: [
    { bbox: { x0: 10, y0: 100, x1: 300, y1: 240 }, words: [word('4', 10, 100, 60, 240, 80), word(' ', 0, 0, 0, 0, 0), word('250', 80, 100, 300, 240, 90)] },
    { bbox: { x0: 10, y0: 10, x1: 100, y1: 40 }, words: [] }
  ] }] }] };
  const lines = toLines(data);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, '4 250');
  assert.equal(lines[0].height, 140);
  assert.equal(lines[0].top, 100);
  assert.deepEqual(lines[0].words.map((w) => w.conf), [80, 90]);
  assert.equal(lines[0].words[1].chars.length, 3);
  assert.deepEqual(toLines(null), []);
});

test('nettoyage d\'image : niveaux de gris, ombre dégradée retirée, texte toujours distinct du fond', () => {
  const w = 120, h = 80, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const shade = 90 + (x / w) * 160;                       // ombre : de 90 à 250 de gauche à droite
    const ink = x % 12 < 3 && y > 20 && y < 60;             // « traits » noirs
    const v = ink ? shade * 0.15 : shade;
    const j = (y * w + x) * 4; px[j] = v; px[j + 1] = v; px[j + 2] = v; px[j + 3] = 255;
  }
  enhance(px, w, h);
  const at = (x, y) => px[(y * w + x) * 4];
  for (let i = 0; i < px.length; i += 4) assert.ok(px[i] === px[i + 1] && px[i + 1] === px[i + 2] && px[i + 3] === 255);
  // fond clair et trait sombre aussi bien à gauche (ombre forte) qu'à droite (éclairé)
  for (const x0 of [0, 108]) { assert.ok(at(x0 + 6, 10) > 150, `fond ${x0}`); assert.ok(at(x0 + 1, 40) < 110, `trait ${x0}`); }
});
