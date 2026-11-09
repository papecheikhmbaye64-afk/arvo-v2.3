import { useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { FEATURED, currencyName, currencySymbol } from '../lib/money.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function CurrencyPicker({ title, current, codes, onPick, onClose }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const all = [...new Set([...FEATURED, 'XAF', ...codes])];
    const rank = (c) => { const i = FEATURED.indexOf(c); return i === -1 ? 1000 : i; };
    all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const n = norm(q.trim());
    return all.map((code) => ({ code, name: cap(currencyName(code)) })).filter((c) => !n || norm(c.code).includes(n) || norm(c.name).includes(n));
  }, [codes, q]);

  return (
    <Sheet title={title} onClose={onClose} labelledBy="picker-title">
      <label className="search">
        <Icon name="search" size={18} />
        <input data-autofocus type="search" placeholder="Rechercher une devise" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une devise" enterKeyHint="search" />
      </label>
      <ul className="picker-list">
        {list.map((c) => (
          <li key={c.code}>
            <button type="button" className={`picker-row ${c.code === current ? 'is-current' : ''}`} onClick={() => onPick(c.code)} aria-pressed={c.code === current}>
              <span className="code-badge" aria-hidden="true">{c.code}</span>
              <span className="picker-name"><strong>{c.name}</strong><small>{currencySymbol(c.code) === c.code ? c.code : `${c.code} · ${currencySymbol(c.code)}`}</small></span>
              {c.code === current && <Icon name="check" size={20} />}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="picker-empty">Aucune devise ne correspond à « {q} ».</li>}
      </ul>
    </Sheet>
  );
}
