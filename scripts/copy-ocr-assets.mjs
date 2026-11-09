// Copie les fichiers de l'OCR (moteur WebAssembly, worker, modèle français) dans public/ocr/ :
// tout est servi par l'appli elle-même, rien n'est téléchargé depuis un site tiers et les photos ne quittent pas l'appareil.
// Lancé automatiquement avant `npm run dev` et `npm run build`. Le dossier produit n'est pas versionné.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
const nm = (...p) => join(root, 'node_modules', ...p);

const files = [
  [nm('tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js'],
  // Variantes LSTM seules : le navigateur n'en télécharge qu'une, selon ses capacités (SIMD).
  [nm('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [nm('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [nm('tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [nm('@tesseract.js-data', 'fra', '4.0.0_best_int', 'fra.traineddata.gz'), join('lang', 'fra.traineddata.gz')]
];

mkdirSync(join(out, 'lang'), { recursive: true });
for (const [from, to] of files) {
  if (!existsSync(from)) { console.error(`OCR : fichier introuvable (${from}). Lancez « npm install ».`); process.exit(1); }
  copyFileSync(from, join(out, to));
}
console.log(`OCR : ${files.length} fichiers copiés dans public/ocr/`);
