// Montants en unités mineures (entiers) : aucun flottant n'est stocké ni additionné.
const NAMES = {
  XOF: 'Franc CFA (BCEAO)', XAF: 'Franc CFA (BEAC)', EUR: 'Euro', USD: 'Dollar américain', GBP: 'Livre sterling',
  CAD: 'Dollar canadien', MAD: 'Dirham marocain', GHS: 'Cedi ghanéen', NGN: 'Naira nigérian', GMD: 'Dalasi gambien'
};
const SYMBOLS = { XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', GBP: '£', CAD: 'CA$', GHS: 'GH₵', NGN: '₦' };
export const FEATURED = ['XOF', 'EUR', 'USD', 'GBP', 'CAD', 'MAD', 'GHS', 'NGN', 'GMD'];

const decCache = new Map();
export function decimals(code) {
  if (decCache.has(code)) return decCache.get(code);
  let d = 2;
  if (code === 'XOF' || code === 'XAF') d = 0;
  else {
    try { d = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; } catch { d = 2; }
  }
  decCache.set(code, d);
  return d;
}

export function currencyName(code) {
  if (NAMES[code]) return NAMES[code];
  try { const n = new Intl.DisplayNames(['fr'], { type: 'currency' }).of(code); if (n && n !== code) return n; } catch { /* ignore */ }
  return code;
}
export function currencySymbol(code) { return SYMBOLS[code] || code; }

/**
 * Texte saisi -> texte canonique « 1234.56 » (point décimal, sans séparateur de milliers), ou null.
 * Formats acceptés : « 1 234,5 », « 1.234,5 », « 1,234.5 », « 12.5 », « 1.234.567 » (points = milliers),
 * « 1234,5 ». Quand un seul séparateur apparaît : la virgule est toujours décimale ; le point est un
 * séparateur de milliers s'il forme des groupes de 3 chiffres (« 12.500 »), sinon il est décimal (« 12.5 »).
 */
export function canonicalAmount(input) {
  let s = String(input ?? '').replace(/[\s\u00a0\u202f]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Les deux apparaissent : le dernier est le séparateur décimal, l'autre sépare les milliers.
    const dec = lastComma > lastDot ? ',' : '.', thou = dec === ',' ? '.' : ',';
    if (s.split(dec).length > 2) return null;
    s = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    if (s.split(',').length > 2) return null;       // « 1,2,3 » : ambigu, refusé
    s = s.replace(',', '.');
  } else if (lastDot >= 0 && /^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');                        // « 12.500 », « 1.234.567 » : milliers
  }
  return /^(\d+(\.\d*)?|\.\d+)$/.test(s) ? s : null;
}

/** Texte saisi (virgule ou point, espaces et points de milliers tolérés) -> unités mineures, ou null si invalide. */
export function toMinor(input, code) {
  const d = decimals(code);
  const s = typeof input === 'number'
    ? (Number.isFinite(input) ? input.toFixed(Math.max(d, 8)) : null)
    : canonicalAmount(input);
  if (s == null) return null;
  let [i = '0', f = ''] = s.split('.');
  if (i === '') i = '0';
  let up = false;
  if (f.length > d) { up = f.charCodeAt(d) >= 53; f = f.slice(0, d); }
  f = f.padEnd(d, '0');
  let n = Number(i + f);
  if (up) n += 1;
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Mise en forme d'un montant pendant la saisie : points de milliers, virgule décimale.
 * - `decimalIndex` : position (dans `raw`) du séparateur que l'utilisateur vient de taper. Un point tapé ne
 *   peut pas être un séparateur de milliers (ceux-ci sont ajoutés automatiquement) : il est donc lu comme
 *   décimal. S'il existe déjà une virgule, le séparateur tapé est ignoré.
 * - `paste` : texte collé ou rempli automatiquement ; il est interprété en entier (« 1.234,56 », « 1,234.56 »)
 *   puis arrondi comme à l'enregistrement, pour que l'affichage corresponde toujours à la valeur enregistrée.
 * Retourne { text, sig } ; `sig` = nombre de chiffres et de virgules de `text` (sert à replacer le curseur).
 */
export const MAX_INT_DIGITS = 15;
export function formatAmountInput(raw, code, { decimalIndex = -1, paste = false } = {}) {
  const d = decimals(code);
  let int = '', frac = null;
  if (paste) {
    const canon = canonicalAmount(String(raw ?? '').replace(/[^\d.,\s\u00a0\u202f]/g, ''));
    const m = canon == null ? null : toMinor(canon, code);
    if (m == null) return { text: '', sig: 0 };
    const [i, f] = minorToInput(m, code).split(',');
    int = i; frac = f === undefined ? null : f;
  } else {
    let t = String(raw ?? '');
    if (decimalIndex >= 0) {
      const without = t.slice(0, decimalIndex) + t.slice(decimalIndex + 1);
      t = without.includes(',') ? without : `${without.slice(0, decimalIndex)},${without.slice(decimalIndex)}`;
    }
    const k = t.indexOf(',');
    if (k >= 0 && d > 0) { int = t.slice(0, k).replace(/\D/g, ''); frac = t.slice(k + 1).replace(/\D/g, '').slice(0, d); }
    else int = t.replace(/\D/g, '');
  }
  int = int.replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS);
  if (int === '' && frac === null) return { text: '', sig: 0 };
  if (int === '') int = '0';
  const text = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (frac !== null ? `,${frac}` : '');
  return { text, sig: int.length + (frac !== null ? 1 + frac.length : 0) };
}

/** Unités mineures -> chaîne éditable (ex. "1250,5"), pour préremplir un champ. */
export function minorToInput(minor, code) {
  const d = decimals(code);
  const abs = Math.abs(minor), p = 10 ** d;
  const i = Math.floor(abs / p), f = String(abs % p).padStart(d, '0');
  return d ? `${i},${f}`.replace(/0+$/, '').replace(/,$/, '') : String(i);
}

export function formatNumber(minor, code) {
  const d = decimals(code), abs = Math.abs(minor), p = 10 ** d;
  const i = String(Math.floor(abs / p)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return d ? `${i},${String(abs % p).padStart(d, '0')}` : i;
}

export function formatMinor(minor, code, { signed = false } = {}) {
  const sign = minor < 0 ? '− ' : signed && minor > 0 ? '+ ' : '';
  return `${sign}${formatNumber(minor, code)}\u00a0${currencySymbol(code)}`;
}

/** rate = nombre d'unités de `to` pour 1 unité de `from`. */
export function convertMinor(minor, from, to, rate) {
  if (from === to) return minor;
  const v = minor * rate * 10 ** (decimals(to) - decimals(from));
  return Math.round(v + Number.EPSILON * Math.sign(v));
}

export function formatRate(rate) {
  if (!Number.isFinite(rate)) return '—';
  const s = rate >= 100 ? rate.toFixed(2) : rate >= 1 ? rate.toFixed(4) : rate.toPrecision(4);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
}
