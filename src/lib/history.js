// Historique des courses : listes terminées, totaux mensuels, suggestions de produits déjà achetés.
// Fonctions pures (aucun accès au navigateur) : les taux de change sont fournis par l'appelant via `rate(from, to)`.
import { convertMinor } from './money.js';

const MAX_PRICE = 100_000_000_000; // même garde-fou que storage.js (évite de l'importer : pas de dépendance circulaire)
const sum = (items) => items.reduce((t, i) => t + i.priceMinor * i.qty, 0);

/** Minuscules, sans accents ni espaces superflus : sert à comparer des noms d'articles. */
export const normName = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Valide l'historique relu depuis le stockage : une entrée illisible est ignorée, jamais une erreur. */
export function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (!e || typeof e.id !== 'string' || !Number.isSafeInteger(e.at) || !/^[A-Z]{3}$/.test(e.currency) || !Array.isArray(e.items)) continue;
    const items = e.items
      .filter((i) => i && typeof i.name === 'string' && i.name.trim() && Number.isSafeInteger(i.priceMinor) && i.priceMinor >= 0 && i.priceMinor <= MAX_PRICE)
      .map((i) => ({ name: i.name.slice(0, 60), priceMinor: i.priceMinor, qty: Math.min(99, Math.max(1, i.qty | 0 || 1)), cat: typeof i.cat === 'string' ? i.cat : 'other' }));
    if (!items.length) continue;
    const totalMinor = sum(items);
    if (!Number.isSafeInteger(totalMinor)) continue;
    out.push({ id: e.id, at: e.at, currency: e.currency, budget: Number.isSafeInteger(e.budget) && e.budget > 0 ? e.budget : 0, items, totalMinor });
  }
  return out;
}

/** Fige la liste en cours dans une entrée d'historique, ou null si elle est vide. */
export function makeEntry(state, id, at) {
  const items = state.items.map(({ name, priceMinor, qty, cat }) => ({ name, priceMinor, qty, cat }));
  if (!items.length) return null;
  return { id, at, currency: state.currency, budget: state.budget > 0 ? state.budget : 0, items, totalMinor: sum(items) };
}

/**
 * Articles d'une ancienne liste, prêts à être ajoutés à la liste en cours (nouveaux identifiants, rien de coché).
 * Les prix sont convertis dans la devise demandée ; retourne null si le taux manque.
 */
export function entryToItems(entry, currency, rate, makeId) {
  let r = 1;
  if (entry.currency !== currency) {
    r = rate(entry.currency, currency);
    if (r == null) return null;
  }
  return entry.items.map((i) => ({
    id: makeId(), name: i.name, qty: i.qty, cat: i.cat, done: false,
    priceMinor: Math.min(MAX_PRICE, convertMinor(i.priceMinor, entry.currency, currency, r))
  }));
}

const monthIndex = (ms) => { const d = new Date(ms); return d.getFullYear() * 12 + d.getMonth(); };

/**
 * Dépenses des `months` derniers mois (mois en cours inclus), exprimées dans `currency`.
 * Une liste dans une autre devise est convertie au taux fourni ; sans taux, elle est comptée dans `skipped`.
 */
export function monthlySeries(history, { currency, rate, now, months = 6 }) {
  const last = monthIndex(now);
  const series = Array.from({ length: months }, (_, k) => {
    const index = last - (months - 1 - k);
    return { index, year: Math.floor(index / 12), month: index % 12, totalMinor: 0, count: 0 };
  });
  let skipped = 0, converted = 0;
  for (const e of history) {
    const slot = series.find((s) => s.index === monthIndex(e.at));
    if (!slot) continue;
    let v = e.totalMinor;
    if (e.currency !== currency) {
      const r = rate(e.currency, currency);
      if (r == null) { skipped += 1; continue; }
      v = convertMinor(v, e.currency, currency, r);
      converted += 1;
    }
    slot.totalMinor += v;
    slot.count += 1;
  }
  return { series, skipped, converted };
}

/** Variation en % entre deux mois (entier), ou null si le mois de référence est vide. */
export function percentChange(current, previous) {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Produits déjà achetés dont le nom contient la saisie. Les noms qui commencent par la saisie passent d'abord,
 * puis les plus fréquents, puis les plus récents. Le prix proposé est le dernier payé, converti si besoin
 * (0 si le taux manque : l'utilisateur le saisit).
 */
export function suggest(history, query, { exclude = [], limit = 4, currency, rate } = {}) {
  const q = normName(query);
  if (!q) return [];
  const skip = new Set(exclude.map(normName));
  const seen = new Map();
  for (const e of history) {
    for (const i of e.items) {
      const key = normName(i.name);
      if (!key.includes(q) || skip.has(key)) continue;
      const cur = seen.get(key);
      if (!cur) seen.set(key, { key, name: i.name, cat: i.cat, count: 1, at: e.at, priceMinor: i.priceMinor, from: e.currency });
      else {
        cur.count += 1;
        if (e.at > cur.at) Object.assign(cur, { name: i.name, cat: i.cat, at: e.at, priceMinor: i.priceMinor, from: e.currency });
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || b.count - a.count || b.at - a.at)
    .slice(0, limit)
    .map((s) => {
      let priceMinor = s.priceMinor;
      if (s.from !== currency) {
        const r = rate ? rate(s.from, currency) : null;
        priceMinor = r == null ? 0 : Math.min(MAX_PRICE, convertMinor(priceMinor, s.from, currency, r));
      }
      return { name: s.name, cat: s.cat, count: s.count, priceMinor };
    });
}
