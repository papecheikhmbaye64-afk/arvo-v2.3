// Analyse du texte lu sur une étiquette de prix : nom du produit, prix, devise.
// Fonction pure (aucun accès au navigateur ni à l'OCR) : elle reçoit des lignes { text, conf, height, words? }.
// Principe : en cas de doute, ne rien deviner. Un prix n'est présélectionné que s'il est le seul plausible ou
// nettement plus grand que les autres ; un nom n'est prérempli que si la lecture est assez sûre.
import { canonicalAmount, decimals, toMinor } from './money.js';

const MAX_PRICE = 100_000_000_000;
export const MIN_NAME_CONF = 60;   // confiance minimale (0-100) pour préremplir le nom
export const MIN_PRICE_CONF = 50;  // confiance minimale pour retenir un prix
const DOMINANCE = 1.35;            // un prix doit être 35 % plus grand que le suivant pour être présélectionné

const CURRENCIES = [
  [/f\s?cfa|fcfa|\bcfa\b|\bxof\b|\bxaf\b/i, 'XOF'],
  [/€|\beur(?:os?)?\b/i, 'EUR'],
  [/\busd\b|us\$|\$/i, 'USD'],
  [/£|\bgbp\b/i, 'GBP'],
  [/\bmad\b|\bdhs?\b/i, 'MAD'],
  [/gh₵|\bghs\b/i, 'GHS'],
  [/₦|\bngn\b/i, 'NGN'],
  [/\bcad\b|ca\$/i, 'CAD']
];
const CFA = new Set(['XOF', 'XAF']);
export const sameCurrency = (a, b) => a === b || (CFA.has(a) && CFA.has(b));

const NUM = /(?<![\d.,])(\d{1,3}(?:[   .]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/g;
const UNIT_LINE = /(\/\s*(kg|kilos?|l|litres?|100\s?g|100\s?ml|pi[eè]ce|unit[eé])\b|\b(le|au|par|du)\s+(kg|kilos?|litres?|l)\b|prix\s+(au|du|par)\s+(kg|kilos?|litres?|l)\b|€\s?\/)/i;
const OLD_LINE = /(au\s+lieu\s+de|ancien(?:ne)?\s+prix|prix\s+(?:avant|barr[eé]|initial|normal)|\bavant\b|\b[ée]tait\b|\bwas\b|\bstatt\b)/i;
const PROMO_WORD = /(promo|remise|solde|offre|sp[ée]cial|bon\s+plan|-\s?\d{1,2}\s?%)/i;
const MEASURE_AFTER = /^\s*(kg|kilos?|mg|gr?|grammes?|l|litres?|cl|ml|dl|cm|mm|m|pcs|pi[eè]ces?|unit[eé]s?|[x×])\b/i;
const REF_BEFORE = /(r[ée]f\.?|code|art\.?|article|ean|gtin|lot|sku|plu|n°|no\.?|#)\s*:?\s*$/i;
const DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g;
const NOISE_NAME = /^(prix|promo|promotion|offre|nouveau|nouveaut[ée]|new|tva|ttc|ht|unit|r[ée]f|code|origine|dlc|dluo|lot|poids|net|solde|soldes|remise|au\s+kilo|le\s+kg|kg)\b/i;

const letters = (s) => (s.match(/\p{L}/gu) || []).length;
const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);

/** Mots d'une ligne avec leur position dans le texte (le texte de la ligne est les mots séparés par une espace). */
function placeWords(line) {
  if (!Array.isArray(line.words) || !line.words.length) return [];
  let pos = 0;
  return line.words.map((w) => { const start = pos; pos += w.text.length + 1; return { ...w, start, end: start + w.text.length }; });
}

function detectCurrency(text) {
  for (const [re, code] of CURRENCIES) if (re.test(text)) return code;
  return null;
}

function toSentenceCase(s) {
  if (!/\p{Ll}/u.test(s) && letters(s) > 3) {
    const low = s.toLowerCase().replace(/(\d)\s?(l|kg|g|cl|ml)\b/g, (_, d, u) => `${d} ${u === 'l' ? 'L' : u}`);
    return low.charAt(0).toUpperCase() + low.slice(1);
  }
  return s;
}

/**
 * @param {{lines: Array<{text:string, conf?:number, height?:number, top?:number, words?:Array<{text:string, conf?:number, height?:number}>}>}} ocr
 * @param {{currency: string}} opts  devise de la liste (sert aux décimales quand l'étiquette n'en indique pas)
 * @returns {{status:'ok'|'partial'|'fail', name:string, nameAlternatives:string[], prices:Array<{id,minor,currency,text,kind,promo,conf}>, priceId:string|null}}
 */
export function parseLabel(ocr, { currency }) {
  const lines = (ocr?.lines || []).map((l, i) => ({ ...l, i, text: String(l.text || '').trim() })).filter((l) => l.text);
  const allText = lines.map((l) => l.text).join(' \n ');
  const labelHasPromo = PROMO_WORD.test(allText);
  const candidates = [];

  lines.forEach((line) => {
    const words = placeWords(line);
    const masked = line.text.replace(DATE, (m) => ' '.repeat(m.length));
    const isUnit = UNIT_LINE.test(line.text);
    const isOld = OLD_LINE.test(line.text);
    let m;
    NUM.lastIndex = 0;
    while ((m = NUM.exec(masked)) !== null) {
      const raw = m[1], start = m.index, end = start + raw.length;
      const before = masked.slice(Math.max(0, start - 14), start), after = masked.slice(end, end + 14);
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 8) continue;                                                            // code-barres, référence longue
      if (/^\s*%/.test(after) || /-\s?$/.test(before) && /%/.test(after)) continue;               // pourcentage
      if (REF_BEFORE.test(before)) continue;                                                       // « Réf. 458921 »
      if (/[x×]\s*$/i.test(before)) continue;                                                      // « x 6 »
      if (MEASURE_AFTER.test(after) && !/^\s*\//.test(after)) continue;                            // « 5 kg », « 33 cl »
      const near = masked.slice(Math.max(0, start - 4), end + 6);
      const cur = detectCurrency(near);
      const hasSym = !!cur || /^\s?f\b/i.test(after);
      const cur2 = cur || null;
      const canon = canonicalAmount(raw);
      if (canon == null) continue;
      const hasDecimals = /[.,]\d{1,2}$/.test(raw) && !/^\d{1,3}(?:[ .]\d{3})+$/.test(raw);
      const code = cur2 || currency;
      if (hasDecimals && decimals(code) === 0) continue;                                          // décimales sans devise connue : pas un prix fiable
      if (!hasSym && !hasDecimals && digits.length <= 2) continue;                                // « 12 », « N° 3 » : pas un prix
      if (!hasSym && !hasDecimals && /^(19|20)\d{2}$/.test(digits)) continue;                     // une année
      const minor = toMinor(canon, code);
      if (minor == null || minor <= 0 || minor > MAX_PRICE) continue;
      const covered = words.filter((w) => w.start < end && w.end > start);
      const height = Math.max(0, ...covered.map((w) => w.height || 0), covered.length ? 0 : line.height || 0);
      const conf = covered.length ? Math.min(...covered.map((w) => (w.conf ?? line.conf ?? 100))) : (line.conf ?? 100);
      if (conf < MIN_PRICE_CONF) continue;
      candidates.push({ minor, currency: cur2, text: raw, kind: isOld ? 'old' : isUnit ? 'unit' : 'main', height, conf, hasSym, line: line.i });
    }
  });

  // Doublons (même montant) : on garde la lecture la plus grande.
  const uniq = [];
  for (const c of candidates) {
    const twin = uniq.find((u) => u.minor === c.minor && u.kind === c.kind && (u.currency === c.currency || !u.currency || !c.currency));
    if (!twin) uniq.push(c);
    else if (c.height > twin.height) Object.assign(twin, c, { currency: c.currency || twin.currency });
  }
  const mains = uniq.filter((c) => c.kind === 'main').sort((a, b) => b.height - a.height || b.conf - a.conf || a.line - b.line);
  const units = uniq.filter((c) => c.kind === 'unit').sort((a, b) => b.height - a.height);
  const oldOnes = uniq.filter((c) => c.kind === 'old');

  // Présélection : seul candidat, ou nettement plus grand que le suivant. Sinon, l'utilisateur choisit.
  let chosen = null;
  if (mains.length === 1) chosen = mains[0];
  else if (mains.length > 1 && mains[0].height > 0 && mains[0].height >= DOMINANCE * mains[1].height) chosen = mains[0];
  const promoLabel = (c) => c.kind === 'main' && (labelHasPromo || oldOnes.length > 0) && (c === chosen || mains.length === 1);

  const prices = [...mains, ...units].slice(0, 4).map((c, k) => ({
    id: `p${k}`, minor: c.minor, currency: c.currency, text: c.text, kind: c.kind, promo: promoLabel(c), conf: c.conf, _c: c
  }));
  const priceId = chosen ? prices.find((p) => p._c === chosen)?.id ?? null : null;
  prices.forEach((p) => delete p._c);

  // Nom : ligne de texte la plus lisible et la plus grande, sans les nombres ni les mentions secondaires.
  const priceRe = new RegExp(NUM.source, 'g');
  const nameLines = [];
  for (const line of lines) {
    if (UNIT_LINE.test(line.text) || OLD_LINE.test(line.text)) continue;
    let t = line.text.replace(DATE, ' ').replace(priceRe, (n, g, off, str) => (MEASURE_AFTER.test(str.slice(off + n.length, off + n.length + 12)) ? n : ' '));
    for (const [re] of CURRENCIES) t = t.replace(new RegExp(re.source, 'gi'), ' ');
    t = t.replace(/\s\bf\b(?=\s|$)/gi, ' ').replace(/[^\p{L}\p{N}\s'’\-.,&/%+()]/gu, ' ').replace(/\s+/g, ' ').replace(/^[\s\-.,/]+|[\s\-.,/]+$/g, '');
    t = t.replace(/\s(\p{L})$/u, (m, c) => (/[glx]/i.test(c) ? m : ''));            // « Tomates h » : lettre isolée = bruit
    const n = letters(t), chars = t.replace(/\s/g, '').length;
    if (n < 3 || chars === 0 || n / chars < 0.55) continue;
    if (NOISE_NAME.test(t) || t.split(' ').length > 9) continue;
    if (!t.split(' ').some((w) => letters(w) >= 3)) continue;
    const ws = (line.words || []).filter((w) => letters(w.text) > 0);
    const conf = ws.length ? mean(ws.map((w) => w.conf ?? line.conf ?? 100)) : (line.conf ?? 100);
    const height = ws.length ? Math.max(...ws.map((w) => w.height || 0)) : line.height || 0;
    nameLines.push({ text: toSentenceCase(t.slice(0, 60)), conf, height, line: line.i });
  }
  nameLines.sort((a, b) => b.height * (b.conf / 100) - a.height * (a.conf / 100) || a.line - b.line);
  const best = nameLines[0];
  // Un nom qui commence par une minuscule est presque toujours un début de mot manquant (« eille 300 g » pour
  // « Savon de Marseille 300 g ») : on ne le préremplit pas, il reste proposé comme texte lu.
  const nameOk = !!best && best.conf >= MIN_NAME_CONF && /^[\p{Lu}\d]/u.test(best.text);
  const alternatives = nameLines.slice(nameOk ? 1 : 0).filter((n) => n.conf >= 35).slice(0, 3).map((n) => n.text);

  const name = nameOk ? best.text : '';
  const priced = priceId !== null;
  let status = 'partial';
  if (!best && !prices.length) status = 'fail';
  else if (nameOk && priced) status = 'ok';
  return { status, name, nameAlternatives: nameOk ? alternatives : (best ? [best.text, ...alternatives.filter((a) => a !== best.text)].slice(0, 3) : []), prices, priceId };
}
