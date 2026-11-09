// Données de l'appli : un seul objet JSON dans localStorage, lu et écrit sans jamais planter.
import { sanitizeHistory } from './history.js';

const KEY = 'tempo.v2';

export const DEFAULTS = {
  items: [],
  currency: 'XOF',
  theme: null,
  totalHidden: false,
  hintSeen: false,
  budget: 0, // unités mineures de la devise de la liste ; 0 = pas de budget
  history: [], // listes terminées (voir lib/history.js) ; absent des anciennes données : simplement vide
  conv: { from: 'XOF', to: 'EUR', amount: '10.000' }
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const d = JSON.parse(raw);
    const items = Array.isArray(d.items)
      ? d.items.filter((i) => i && typeof i.id === 'string' && typeof i.name === 'string' && Number.isSafeInteger(i.priceMinor)).map((i) => ({
          id: i.id, name: i.name, priceMinor: Math.max(0, i.priceMinor), qty: Math.min(99, Math.max(1, i.qty | 0 || 1)), done: !!i.done, cat: i.cat || 'other'
        }))
      : [];
    return {
      items,
      currency: /^[A-Z]{3}$/.test(d.currency) ? d.currency : DEFAULTS.currency,
      theme: d.theme === 'light' || d.theme === 'dark' ? d.theme : null,
      totalHidden: d.totalHidden === true,
      hintSeen: !!d.hintSeen,
      budget: Number.isSafeInteger(d.budget) && d.budget > 0 && d.budget <= MAX_PRICE_MINOR ? d.budget : 0,
      history: sanitizeHistory(d.history),
      conv: {
        from: /^[A-Z]{3}$/.test(d.conv?.from) ? d.conv.from : DEFAULTS.conv.from,
        to: /^[A-Z]{3}$/.test(d.conv?.to) ? d.conv.to : DEFAULTS.conv.to,
        amount: typeof d.conv?.amount === 'string' ? d.conv.amount.slice(0, 24) : DEFAULTS.conv.amount
      }
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage plein ou bloqué : l'appli continue en mémoire */ }
}

export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export const MAX_PRICE_MINOR = 100_000_000_000; // garde-fou : total toujours sous la limite des entiers sûrs
export const itemsTotal = (items) => items.reduce((sum, i) => sum + i.priceMinor * i.qty, 0);
