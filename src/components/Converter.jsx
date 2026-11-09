import { useState } from 'react';
import Icon from './Icon.jsx';
import { Banner } from './Photo.jsx';
import CurrencyPicker from './CurrencyPicker.jsx';
import { convertMinor, currencyName, currencySymbol, formatAmountInput, formatNumber, formatRate, minorToInput, toMinor } from '../lib/money.js';
import { useAmountField } from '../lib/useAmountField.js';
import { isPegged } from '../lib/fx.js';

const stamp = (ms) => (ms ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(ms) : '');

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function CurrencyButton({ code, label, onClick }) {
  return (
    <button type="button" className="cur-btn" onClick={onClick} aria-label={`${label} : ${currencyName(code)} (${code}). Changer`}>
      <span className="code-badge" aria-hidden="true">{code}</span>
      <span className="cur-name"><strong>{cap(currencyName(code))}</strong><small>{code}</small></span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

export default function Converter({ state, patch, fx, hidden = false, listTotal }) {
  const { from, to, amount } = state.conv;
  const [picking, setPicking] = useState(null); // 'from' | 'to' | null
  const setConv = (c) => patch((s) => ({ conv: { ...s.conv, ...c } }));
  const field = useAmountField(amount, (v) => setConv({ amount: v }), from);

  const st = fx.state;
  const rate = fx.rate(from, to);
  const minor = toMinor(amount, from);
  const result = minor != null && rate != null ? convertMinor(minor, from, to, rate) : null;
  const resultText = result != null ? formatNumber(result, to) : '—';
  const size = resultText.length <= 9 ? 46 : resultText.length <= 13 ? 38 : resultText.length <= 17 ? 31 : 25;
  const pegged = isPegged(from, to);
  const invalid = amount.trim() && minor == null;

  const useTotal = () => {
    const cur = listTotal.currency;
    // Si la devise d'arrivée est déjà celle de la liste, on la change : sinon la « conversion » serait un aller-retour sans effet.
    setConv({ from: cur, to: to === cur ? (cur === 'EUR' ? 'USD' : 'EUR') : to, amount: formatAmountInput(minorToInput(listTotal.minor, cur), cur, { paste: true }).text });
  };

  return (
    <>
      <section className="card conv-card" aria-label="Conversion">
        <Banner name="hero-exchange" />
        <div className="conv-body">
          <div className="conv-block">
            <span className="eyebrow">Je change</span>
            <CurrencyButton code={from} label="Devise de départ" onClick={() => setPicking('from')} />
            <label className={`amount-wrap ${hidden ? 'is-private' : ''}`}>
              <span className="sr-only">Montant en {currencyName(from)}</span>
              <input className="amount-input" type={hidden ? 'password' : 'text'} {...field} placeholder="0" aria-label={hidden ? 'Montant masqué' : undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'amount-err' : undefined} enterKeyHint="done" />
              <em>{currencySymbol(from)}</em>
            </label>
            {invalid && <p className="form-error" id="amount-err" role="alert">Ce montant n’est pas valide.</p>}
          </div>

          <div className="swap-line">
            <button type="button" className="swap-btn" onClick={() => setConv({ from: to, to: from })} aria-label="Inverser les deux devises"><Icon name="swap" size={20} /></button>
          </div>

          <div className="conv-block result-block">
            <span className="eyebrow">Je reçois</span>
            <CurrencyButton code={to} label="Devise d’arrivée" onClick={() => setPicking('to')} />
            <p className="result" aria-live="polite" aria-atomic="true" aria-label={hidden ? 'Montant masqué' : result != null ? `Résultat : ${resultText} ${currencyName(to)}` : 'Pas de résultat'}>
              <span className="result-num" style={{ fontSize: hidden ? 40 : size }} key={hidden ? 'private' : resultText}>{hidden ? '••••••' : resultText}</span>
              {result != null && !hidden && <em>{currencySymbol(to)}</em>}
            </p>
          </div>
        </div>
      </section>

      {rate != null ? (
        <p className="rate-line">
          <span>{hidden ? 'Taux de conversion masqué' : rate < 1 ? <>1 {to} = <strong>{formatRate(1 / rate)} {from}</strong></> : <>1 {from} = <strong>{formatRate(rate)} {to}</strong></>}</span>
          <button type="button" className={`icon-btn sm ${st.loading ? 'spin' : ''}`} onClick={() => fx.refresh(true)} aria-label="Actualiser les taux" disabled={pegged}><Icon name="refresh" size={16} /></button>
        </p>
      ) : null}
      <p className="rate-meta">
        {hidden ? 'Taux de change masqués par le mode confidentialité.' : pegged ? 'Parité fixe du franc CFA avec l’euro (1 € = 655,957 FCFA).'
          : st.providerAt ? `Taux de marché du ${stamp(st.providerAt)}${st.stale ? ' · non actualisé' : ''}` : ''}
      </p>

      {rate == null && (
        <div className="notice" role="status">
          <Icon name="alert" size={20} />
          <p>{st.loading ? 'Chargement des taux de change…'
            : fx.available() ? `Aucun taux n’est disponible pour ${from} → ${to}. Choisissez une autre devise.`
            : `Les taux de change ne sont pas disponibles${st.error ? ` (${st.error})` : ''}. Vérifiez votre connexion.`}</p>
          {!st.loading && !fx.available() && <button type="button" className="link-btn" onClick={() => fx.refresh(true)}>Réessayer</button>}
        </div>
      )}
      {rate != null && st.stale && !pegged && (
        <div className="notice" role="status">
          <Icon name="alert" size={20} />
          <p>Impossible d’actualiser les taux : le dernier relevé connu est utilisé.</p>
          <button type="button" className="link-btn" onClick={() => fx.refresh(true)}>Réessayer</button>
        </div>
      )}

      {listTotal.minor > 0 && (
        <button type="button" className="btn btn-glass use-total" onClick={useTotal}>
          <Icon name="basket" size={20} />
          <span>Utiliser le total de mes courses<small>{hidden ? '••••••' : `${formatNumber(listTotal.minor, listTotal.currency)} ${currencySymbol(listTotal.currency)}`}</small></span>
        </button>
      )}

      <p className="fine">Taux indicatifs fournis par <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a> : ils n’incluent ni les frais ni la marge de votre banque ou de votre opérateur.</p>

      {picking && (
        <CurrencyPicker
          title={picking === 'from' ? 'Devise de départ' : 'Devise d’arrivée'}
          current={picking === 'from' ? from : to}
          codes={fx.currencies()}
          onClose={() => setPicking(null)}
          onPick={(code) => {
            if (picking === 'from') setConv(code === to ? { from: code, to: from } : { from: code });
            else setConv(code === from ? { to: code, from: to } : { to: code });
            setPicking(null);
          }}
         
        />
      )}
    </>
  );
}
