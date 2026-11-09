// Taux de change réels (open.er-api.com / ExchangeRate-API, sans clé, CORS ouvert).
// Cache local, dernier taux valide en cas d'échec, jamais de valeur inventée.
export const FX_URL = 'https://open.er-api.com/v6/latest/USD';
export const FX_SOURCE = 'ExchangeRate-API (open.er-api.com)';
const KEY = 'tempo.fx.v1';
const TTL = 6 * 3600 * 1000;
const CFA = new Set(['XOF', 'XAF']);
export const PEG = 655.957;
export const isPegged = (a, b) => (CFA.has(a) && (CFA.has(b) || b === 'EUR')) || (a === 'EUR' && CFA.has(b));

export function createFx({ fetchImpl, storage, now = () => Date.now(), ttl = TTL, timeout = 8000 } = {}) {
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  const store = storage ?? (() => { try { return globalThis.localStorage; } catch { return null; } })();
  const listeners = new Set();
  const state = { rates: null, providerAt: null, fetchedAt: null, stale: false, loading: false, error: null };
  let inflight = null;

  try {
    const raw = store?.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.rates && typeof c.rates === 'object') Object.assign(state, { rates: c.rates, providerAt: c.providerAt, fetchedAt: c.fetchedAt });
    }
  } catch { /* cache illisible : ignoré */ }

  const emit = () => listeners.forEach((l) => l(state));

  async function refresh(force = false) {
    if (inflight) return inflight;
    if (!force && state.rates && now() - state.fetchedAt < ttl) { state.stale = false; return state; }
    state.loading = true; state.error = null; emit();
    inflight = (async () => {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
      try {
        const res = await doFetch(FX_URL, ctl ? { signal: ctl.signal } : undefined);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (j.result !== 'success' || !j.rates || typeof j.rates.USD !== 'number') throw new Error('Réponse invalide');
        const rates = {};
        for (const [k, v] of Object.entries(j.rates)) if (typeof v === 'number' && v > 0) rates[k] = v;
        Object.assign(state, { rates, providerAt: (j.time_last_update_unix || 0) * 1000 || now(), fetchedAt: now(), stale: false, error: null });
        try { store?.setItem(KEY, JSON.stringify({ rates, providerAt: state.providerAt, fetchedAt: state.fetchedAt })); } catch { /* quota */ }
      } catch (e) {
        state.error = e?.name === 'AbortError' ? 'Délai dépassé' : (e?.message || 'Réseau indisponible');
        state.stale = !!state.rates;
      } finally {
        if (timer) clearTimeout(timer);
        state.loading = false; inflight = null; emit();
      }
      return state;
    })();
    return inflight;
  }

  /** Unités de `to` pour 1 `from`, ou null si indisponible. */
  function rate(from, to) {
    if (from === to) return 1;
    // Parité fixe officielle : 1 EUR = 655,957 FCFA (XOF et XAF), valable même hors ligne.
    if (CFA.has(from) && CFA.has(to)) return 1;
    if (CFA.has(from) && to === 'EUR') return 1 / PEG;
    if (from === 'EUR' && CFA.has(to)) return PEG;
    const r = state.rates;
    if (!r || !r[from] || !r[to]) return null;
    return r[to] / r[from];
  }

  return {
    state, refresh, rate,
    available: () => !!state.rates,
    currencies: () => (state.rates ? Object.keys(state.rates) : []),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
