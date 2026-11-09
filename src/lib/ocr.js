// Lecture d'une photo d'étiquette, entièrement sur l'appareil (Tesseract.js, WebAssembly).
// - Le moteur, le worker et le modèle français sont servis par l'appli elle-même (public/ocr) : aucun site tiers.
// - La photo n'est jamais envoyée, stockée ni conservée : décodée, réduite dans un canvas, lue, puis libérée.
// - Le moteur est chargé à la demande (import dynamique) et arrêté dès que la feuille de scan se ferme.
import { parseLabel } from './labelParser.js';

const MAX_SIDE = 1600;   // au-delà, la lecture ralentit sans gagner en précision
const MIN_SIDE = 1000;
const MAX_MS = 12000;    // au-delà, on n'enchaîne plus de passes de secours   // en deçà, les chiffres sont trop petits pour être lus : on agrandit
const asset = (p) => new URL(`ocr/${p}`, document.baseURI).href;

const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);

/** Erreur dont le `kind` ('engine' | 'image') permet d'afficher un message adapté. */
export class ScanError extends Error {
  constructor(kind, cause) { super(kind); this.kind = kind; this.cause = cause; }
}

/**
 * Prépare le moteur en arrière-plan (à appeler dès l'ouverture de la feuille : il est prêt quand la photo l'est).
 * `onProgress({ stage: 'load'|'read', pct })` reçoit l'avancement.
 */
export function createEngine({ onProgress } = {}) {
  let worker = null;
  let stopped = false;
  const notify = (m) => {
    if (!onProgress || !m) return;
    if (m.status === 'recognizing text') onProgress({ stage: 'read', pct: Math.round((m.progress || 0) * 100) });
    else onProgress({ stage: 'load', pct: null });
  };

  const ready = (async () => {
    let lib;
    try { lib = await import('tesseract.js/dist/tesseract.esm.min.js'); } catch (e) { throw new ScanError('engine', e); }
    const create = lib.createWorker || lib.default?.createWorker;
    let w;
    try {
      w = await create('fra', 1, {
        workerPath: asset('worker.min.js'), corePath: asset(''), langPath: asset('lang'),
        gzip: true, workerBlobURL: false, cacheMethod: 'none', logger: notify
      });
      await w.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1', user_defined_dpi: '300' });
    } catch (e) { try { await w?.terminate(); } catch { /* déjà arrêté */ } throw new ScanError('engine', e); }
    if (stopped) { await w.terminate().catch(() => {}); throw new ScanError('engine'); }
    worker = w;
    return w;
  })();
  ready.catch(() => {});

  return {
    ready,
    /** Lit une image. `psm` : '11' texte épars (par défaut), '7' une seule ligne, '6' un bloc. */
    async recognize(canvas, { psm = '11' } = {}) {
      const w = await ready;
      await w.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await w.recognize(canvas, {}, { blocks: true });
      return toLines(data);
    },
    async terminate() {
      stopped = true;
      const w = worker || await ready.catch(() => null);
      worker = null;
      try { await w?.terminate(); } catch { /* sans conséquence */ }
    }
  };
}

/** Lignes lues -> format attendu par parseLabel (mots avec hauteur et confiance). */
export function toLines(data) {
  const lines = [];
  for (const b of data?.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const words = (l.words || [])
      .filter((w) => w.text && w.text.trim())
      .map((w) => ({ text: w.text.trim(), conf: w.confidence, height: w.bbox.y1 - w.bbox.y0, box: w.bbox, chars: (w.symbols || []).map((c) => ({ x1: c.bbox.x1 })) }));
    if (!words.length) continue;
    lines.push({ text: words.map((w) => w.text).join(' '), conf: mean(words.map((w) => w.conf)), height: Math.max(...words.map((w) => w.height)), top: l.bbox.y0, box: l.bbox, words });
  }
  return lines;
}

/**
 * Décode la photo (en respectant son orientation), la ramène à une taille lisible, en niveaux de gris,
 * en gommant les ombres et le manque de contraste. Retourne { canvas, inverted(), dispose() }.
 */
export async function prepareImage(file, opts = {}) {
  const maxSide = opts.maxSide || MAX_SIDE, minSide = opts.minSide ?? MIN_SIDE;
  let bitmap;
  try {
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bitmap = await createImageBitmap(file); }
  } catch (e) { throw new ScanError('image', e); }

  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long > maxSide ? maxSide / long : long < minSide ? Math.min(3, minSide / long) : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  enhance(img.data, w, h, opts);
  ctx.putImageData(img, 0, 0);

  let alt = null;
  return {
    canvas,
    inverted() {
      if (!alt) {
        alt = document.createElement('canvas'); alt.width = w; alt.height = h;
        const c = alt.getContext('2d', { willReadFrequently: true });
        const d = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 255 - d.data[i]; }
        c.putImageData(d, 0, 0);
      }
      return alt;
    },
    dispose() { canvas.width = 0; canvas.height = 0; if (alt) { alt.width = 0; alt.height = 0; alt = null; } }
  };
}

/** Niveaux de gris, fond uniformisé (ombres, dégradés), puis étirement du contraste. Modifie `px` sur place. */
export function enhance(px, w, h, { blockDiv = 8 } = {}) {
  const n = w * h;
  const g = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < n; i += 1, j += 4) g[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;

  // Fond estimé par la moyenne de blocs (interpolée) : on divise par lui pour retirer les ombres.
  const bs = Math.max(24, Math.round(Math.max(w, h) / blockDiv));
  const bw = Math.ceil(w / bs), bh = Math.ceil(h / bs);
  const sum = new Float64Array(bw * bh), cnt = new Uint32Array(bw * bh);
  for (let y = 0; y < h; y += 1) {
    const row = Math.floor(y / bs) * bw;
    for (let x = 0; x < w; x += 1) { const k = row + Math.floor(x / bs); sum[k] += g[y * w + x]; cnt[k] += 1; }
  }
  const bg = new Float32Array(bw * bh);
  for (let k = 0; k < bg.length; k += 1) bg[k] = sum[k] / cnt[k];
  const at = (bx, by) => bg[Math.min(bh - 1, Math.max(0, by)) * bw + Math.min(bw - 1, Math.max(0, bx))];
  const out = new Float32Array(n);
  let lo = 255, hi = 0;
  const hist = new Uint32Array(256);
  for (let y = 0; y < h; y += 1) {
    const fy = y / bs - 0.5, by = Math.floor(fy), ty = fy - by;
    for (let x = 0; x < w; x += 1) {
      const fx = x / bs - 0.5, bx = Math.floor(fx), tx = fx - bx;
      const b = (at(bx, by) * (1 - tx) + at(bx + 1, by) * tx) * (1 - ty) + (at(bx, by + 1) * (1 - tx) + at(bx + 1, by + 1) * tx) * ty;
      // Le fond local devient gris clair (200) ; ce qui est plus clair ou plus sombre garde son écart.
      const v = Math.max(0, Math.min(255, (g[y * w + x] / Math.max(24, b)) * 200));
      out[y * w + x] = v;
      hist[Math.round(v)] += 1;
    }
  }
  // Étirement entre les percentiles 1 % et 99 % (robuste aux reflets et aux pixels isolés).
  let acc = 0;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= n * 0.01) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) { acc += hist[v]; if (acc >= n * 0.01) { hi = v; break; } }
  const span = Math.max(40, hi - lo);
  for (let i = 0, j = 0; i < n; i += 1, j += 4) {
    const v = Math.max(0, Math.min(255, ((out[i] - lo) / span) * 255));
    px[j] = px[j + 1] = px[j + 2] = v; px[j + 3] = 255;
  }
}

const rank = (r) => (r.status === 'ok' ? 2 : r.status === 'partial' ? 1 : 0);

const HAS_DIGIT = /\d/;
const digitsOf = (t) => t.replace(/\D/g, '');
const numericPrefix = (t) => (t.replace(/^[^\d]+/, '').match(/^\d[\d.,]*/) || [''])[0].replace(/[.,]+$/, '');

/** Recadre une zone de `canvas`, la ramène à ~72 px de haut (taille idéale pour le moteur) avec une marge de fond. */
function crop(canvas, box) {
  const pad = Math.round((box.y1 - box.y0) * 0.15) + 4;
  const sx = Math.max(0, box.x0 - pad), sy = Math.max(0, box.y0 - pad);
  const sw = Math.min(canvas.width - sx, box.x1 - box.x0 + pad * 2), sh = Math.min(canvas.height - sy, box.y1 - box.y0 + pad * 2);
  if (sw < 4 || sh < 4) return null;
  const k = Math.min(3, 72 / sh), M = 16;
  const out = document.createElement('canvas');
  out.width = Math.round(sw * k) + M * 2; out.height = Math.round(sh * k) + M * 2;
  const c = out.getContext('2d', { willReadFrequently: true });
  const bg = canvas.getContext('2d').getImageData(sx, sy, 1, 1).data;
  c.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`; c.fillRect(0, 0, out.width, out.height);
  c.drawImage(canvas, sx, sy, sw, sh, M, M, Math.round(sw * k), Math.round(sh * k));
  return out;
}

/**
 * Contre-vérification des nombres : chaque ligne qui contient des chiffres est relue seule, à une taille normalisée.
 * Les gros caractères sont lus avec une confiance faible par le moteur, et la devise (« FCFA ») est parfois lue
 * comme du bruit collé au prix : la relecture règle les deux. Règle : deux lectures indépendantes doivent donner
 * exactement les mêmes chiffres.
 *  - elles concordent : le nombre est retenu, avec la confiance de la relecture, sans le bruit collé ;
 *  - elles divergent (un « 4 » lu « À », un chiffre manquant…) : le nombre est écarté. On ne devine jamais un prix.
 */
const CURRENCY_WORD = /^(f|fcfa|cfa|xof|xaf|eur|€|\$|£|usd|dh|mad)$/i;
async function verifyNumbers(engine, canvas, lines) {
  const out = [];
  for (const line of lines) {
    const idx = line.words.map((w, i) => (HAS_DIGIT.test(w.text) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length || !line.words[idx[0]].box) { out.push(line); continue; }
    let first = idx[0];
    const last = idx[idx.length - 1];
    // Un petit mot collé juste avant le nombre est probablement un chiffre mal lu (« À 250 » pour « 4 250 ») : on l'inclut.
    const prev = line.words[first - 1];
    const lead = line.words[first];
    if (prev?.box && prev.text.length <= 2 && !CURRENCY_WORD.test(prev.text) && lead.box.x0 - prev.box.x1 < (lead.box.y1 - lead.box.y0) * 0.8) first -= 1;
    const run = line.words.slice(first, last + 1);
    // Bruit collé après le dernier nombre (« 250:5m ») : on coupe juste après son dernier chiffre.
    const tail = run[run.length - 1];
    const pre = numericPrefix(tail.text);
    const endChar = tail.text.search(/\d/) + pre.length - 1;
    const x1 = pre && tail.chars?.[endChar] ? tail.chars[endChar].x1 : tail.box.x1;
    const box = { x0: Math.min(...run.map((w) => w.box.x0)), y0: Math.min(...run.map((w) => w.box.y0)), x1: Math.max(x1, ...run.slice(0, -1).map((w) => w.box.x1)), y1: Math.max(...run.map((w) => w.box.y1)) };
    const orig = run.map((w) => numericPrefix(w.text)).filter(Boolean);
    const want = digitsOf(orig.join(''));
    const tiny = crop(canvas, box);
    let again = [];
    if (tiny) { try { again = await engine.recognize(tiny, { psm: '7' }); } finally { tiny.width = 0; tiny.height = 0; } }
    const got = again.flatMap((l) => l.words).filter((w) => HAS_DIGIT.test(w.text));
    const gotDigits = digitsOf(got.map((w) => numericPrefix(w.text)).join(''));
    const gotConf = got.length ? Math.min(...got.map((w) => w.conf)) : 0;
    // Concordance exacte ; ou un chiffre de plus en tête lu par la relecture là où le moteur avait lu une lettre
    // (« À 250 » -> 4250), à condition que la relecture soit très sûre et que le petit mot corresponde à ce chiffre.
    const junk = line.words.slice(first, idx[0]).reduce((n, w) => n + w.text.length, 0);
    const recovered = junk > 0 && gotConf >= 85 && gotDigits.endsWith(want) && gotDigits.length - want.length <= junk;
    const agree = want.length > 0 && (gotDigits === want || recovered);
    const finalText = agree && recovered ? [gotDigits] : orig;
    const conf = agree ? (gotConf >= 20 ? Math.max(gotConf, 50) : 0) : 0;
    const words = [
      ...line.words.slice(0, first),
      ...(conf ? finalText.map((t) => ({ text: t, conf, height: box.y1 - box.y0 })) : run.map((w) => ({ ...w, conf: 0 }))),
      ...line.words.slice(last + 1)
    ];
    out.push({ ...line, text: words.map((w) => w.text).join(' '), words, conf, reread: `${want}→${gotDigits}@${Math.round(gotConf)}` });
  }
  return out;
}

/** Passes de lecture, de la plus courante à la plus coûteuse : on s'arrête dès qu'un prix exploitable apparaît. */
const PASSES = [
  { image: 'main', psm: '11' },       // image nettoyée, texte épars
  { image: 'inverted', psm: '11' },   // texte clair sur fond sombre
  { image: 'main', psm: '6' },        // un seul bloc de texte : récupère les très gros chiffres isolés
  { image: 'small', psm: '11' }       // image réduite de moitié : gros caractères
];

/**
 * Lit une photo d'étiquette et renvoie l'analyse (voir labelParser.parseLabel).
 * La photo est libérée dans tous les cas. `trace` (tableau, facultatif) reçoit les lignes lues à chaque passe.
 */
export async function readLabel(engine, file, { currency, onStep, trace } = {}) {
  onStep?.('prepare');
  const prepared = await prepareImage(file);
  let small = null;
  try {
    await engine.ready;
    const results = [];
    const started = performance.now();
    for (let k = 0; k < PASSES.length; k += 1) {
      if (k > 0 && performance.now() - started > MAX_MS) break;   // téléphone lent : on garde ce qu'on a
      const { image, psm } = PASSES[k];
      onStep?.(k === 0 ? 'read' : 'retry');
      let canvas = prepared.canvas;
      if (image === 'inverted') canvas = prepared.inverted();
      if (image === 'small') {
        if (!small) small = await prepareImage(file, { maxSide: 800, minSide: 0 });
        canvas = small.canvas;
      }
      const raw = await engine.recognize(canvas, { psm });
      const lines = await verifyNumbers(engine, canvas, raw);
      trace?.push({ pass: `${image}/${psm}`, lines: lines.map((l) => `${Math.round(l.conf)}|h${l.height}|${l.text}${l.reread ? ` <${l.reread}>` : ''}`) });
      const parsed = parseLabel({ lines }, { currency });
      results.push(parsed);
      if (parsed.prices.length) break;
    }
    return mergePasses(results);
  } finally {
    prepared.dispose();
    small?.dispose();
  }
}

/** Retient la dernière passe qui a trouvé un prix (sinon la meilleure) ; reprend le nom d'une passe précédente s'il manque. */
function mergePasses(results) {
  const withPrice = results.filter((r) => r.prices.length);
  let best = withPrice.length ? withPrice[withPrice.length - 1] : results.reduce((a, r) => (rank(r) > rank(a) ? r : a), results[0]);
  if (!best.name) {
    const named = results.find((r) => r.name);
    if (named) {
      const status = best.priceId ? 'ok' : 'partial';
      best = { ...best, name: named.name, nameAlternatives: named.nameAlternatives, status };
    }
  }
  return best;
}
