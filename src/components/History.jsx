import { useState } from 'react';
import Icon from './Icon.jsx';
import { entryToItems, monthlySeries, percentChange } from '../lib/history.js';
import { currencySymbol, formatNumber } from '../lib/money.js';
import { uid } from '../lib/storage.js';

const MASK = '••••••';
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const monthLong = (y, m) => cap(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)));
const monthName = (y, m) => new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(y, m, 1));
const monthShort = (y, m) => new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(y, m, 1)).replace('.', '');
const dayLabel = (at) => {
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(d));
};

/** Dépenses des six derniers mois, calculées à partir des listes terminées. */
function Dashboard({ history, currency, fx, hidden }) {
  const [now] = useState(() => Date.now());
  const { series, skipped, converted } = monthlySeries(history, { currency, rate: (a, b) => fx.rate(a, b), now, months: 6 });
  const [sel, setSel] = useState(series.length - 1);
  const cur = series[sel];
  const prev = sel > 0 ? series[sel - 1] : null;
  const change = prev ? percentChange(cur.totalMinor, prev.totalMinor) : null;
  const max = Math.max(...series.map((m) => m.totalMinor), 1);
  const symbol = currencySymbol(currency);
  const money = (minor) => (hidden ? MASK : formatNumber(minor, currency));

  return (
    <section className="card dash hist-dash" aria-labelledby="dash-title">
      <span className="eyebrow" id="dash-title">{monthLong(cur.year, cur.month)}</span>
      <p className="dash-total" aria-live="polite" aria-atomic="true">
        <span>{money(cur.totalMinor)}</span><span className="unit">{symbol}</span>
      </p>
      <p className="dash-sub">
        {cur.count ? plural(cur.count, 'liste', 'listes') : 'Aucune liste'}
        {change !== null && cur.count > 0 && ` · ${change === 0 ? 'Stable' : `${change > 0 ? '+' : '−'} ${Math.abs(change)} %`} par rapport à ${monthName(prev.year, prev.month)}`}
      </p>
      <div className="dash-bars" role="group" aria-label="Dépenses des six derniers mois">
        {series.map((m, i) => (
          <button
            key={m.index} type="button" className={`bar ${i === sel ? 'is-on' : ''}`} aria-pressed={i === sel}
            aria-label={`${monthLong(m.year, m.month)} : ${hidden ? 'montant masqué' : `${formatNumber(m.totalMinor, currency)} ${symbol}`}`}
            onClick={() => setSel(i)}
          >
            <span className="bar-track"><span className="bar-fill" style={{ height: `${m.totalMinor ? Math.max(4, (m.totalMinor / max) * 100) : 0}%` }} /></span>
            <small>{monthShort(m.year, m.month)}</small>
          </button>
        ))}
      </div>
      {converted > 0 && <p className="dash-note">Les listes dans une autre devise sont converties au taux du jour.</p>}
      {skipped > 0 && <p className="dash-note">{plural(skipped, 'liste non comptée', 'listes non comptées')} : taux indisponibles.</p>}
    </section>
  );
}

export default function History({ state, patch, fx, toast, go }) {
  const { history, currency } = state;
  const [open, setOpen] = useState(null);
  const sorted = [...history].sort((a, b) => b.at - a.at);

  const duplicate = (entry) => {
    const items = entryToItems(entry, currency, (a, b) => fx.rate(a, b), uid);
    if (!items) { toast({ text: 'Taux indisponibles : impossible de convertir ces prix pour le moment.' }); return; }
    const ids = new Set(items.map((i) => i.id));
    patch((s) => ({ items: [...items, ...s.items] }));
    toast({ text: `${plural(items.length, 'article ajouté', 'articles ajoutés')} à votre liste`, undo: () => patch((s) => ({ items: s.items.filter((i) => !ids.has(i.id)) })) });
    go('courses');
  };

  const remove = (entry) => {
    const index = history.findIndex((h) => h.id === entry.id);
    patch((s) => ({ history: s.history.filter((h) => h.id !== entry.id) }));
    setOpen((o) => (o === entry.id ? null : o));
    toast({
      text: 'Liste supprimée de l’historique',
      undo: () => patch((s) => (s.history.some((h) => h.id === entry.id) ? {} : { history: [...s.history.slice(0, index), entry, ...s.history.slice(index)] }))
    });
  };

  if (!history.length) {
    return (
      <section className="empty" aria-label="Historique vide">
        <h2>Aucune liste terminée</h2>
        <p>Quand vous terminez une liste depuis l’onglet Courses, elle est conservée ici avec vos dépenses du mois.</p>
        <button type="button" className="link-btn" onClick={() => go('courses')}>Aller aux courses<Icon name="arrow" size={16} /></button>
      </section>
    );
  }

  return (
    <>
      <Dashboard history={history} currency={currency} fx={fx} hidden={state.totalHidden} />
      <section className="hist-list" aria-label="Listes terminées">
        <span className="eyebrow hist-title">Listes terminées</span>
        <ul>
          {sorted.map((e) => {
            const isOpen = open === e.id;
            const sym = currencySymbol(e.currency);
            return (
              <li key={e.id} className="card hist-item">
                <button type="button" className="hist-main" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>
                  <span className="hist-text">
                    <strong>{dayLabel(e.at)}</strong>
                    <small>{plural(e.items.length, 'article', 'articles')}</small>
                  </span>
                  <span className="hist-total">{state.totalHidden ? MASK : formatNumber(e.totalMinor, e.currency)}<i>{sym}</i></span>
                  <Icon name="chevron" size={18} className={isOpen ? 'chev is-open' : 'chev'} />
                </button>
                {isOpen && (
                  <ul className="hist-items" aria-label="Articles de cette liste">
                    {e.items.map((i, k) => (
                      <li key={`${k}-${i.name}`}>
                        <span>{i.name}{i.qty > 1 && <small> × {i.qty}</small>}</span>
                        <span>{i.priceMinor ? (state.totalHidden ? MASK : formatNumber(i.priceMinor * i.qty, e.currency)) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="hist-actions">
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => duplicate(e)}>Dupliquer</button>
                  <button type="button" className="icon-btn sm" onClick={() => remove(e)} aria-label={`Supprimer la liste du ${dayLabel(e.at)}`}><Icon name="trash" size={18} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
