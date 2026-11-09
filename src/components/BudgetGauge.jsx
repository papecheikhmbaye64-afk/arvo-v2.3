import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { budgetStatus } from '../lib/budget.js';
import { MAX_PRICE_MINOR } from '../lib/storage.js';
import { currencySymbol, formatAmountInput, formatNumber, minorToInput, toMinor } from '../lib/money.js';
import { useAmountField } from '../lib/useAmountField.js';

const MASK = '••••••';

/** Jauge sous la carte « Total » : la piste se remplit avec la part de budget consommée. */
export default function BudgetGauge({ total, budget, currency, hidden, onEdit }) {
  const { fill, pct, level, over } = budgetStatus(total, budget);
  const symbol = currencySymbol(currency);
  const money = (minor) => (hidden ? MASK : formatNumber(minor, currency));

  // Le remplissage part de 0 à l'apparition, puis glisse vers sa valeur à chaque changement.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(fill)));
    return () => cancelAnimationFrame(id);
  }, [fill]);

  if (!budget) {
    return (
      <section className="card gauge gauge-empty" aria-label="Budget">
        <div className="gauge-empty-text">
          <span className="eyebrow">Budget</span>
          <p>Aucun plafond fixé</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>Définir un budget</button>
      </section>
    );
  }

  return (
    <section className="card gauge" data-level={level} aria-label="Budget">
      <div className="gauge-head">
        <span className="eyebrow">Budget</span>
        <span className="gauge-pct" aria-hidden="true">{pct}&nbsp;%</span>
      </div>
      <p className="gauge-main" aria-live="polite" aria-atomic="true">
        {level === 'over'
          ? <><Icon name="alert" size={20} stroke={2.2} />Dépassé de&nbsp;<strong>{money(over)}</strong><span>{symbol}</span></>
          : <>Reste&nbsp;<strong>{money(budget - total)}</strong><span>{symbol}</span></>}
      </p>
      <div
        className="gauge-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)}
        aria-valuetext={`${pct} % du budget${level === 'over' ? ', dépassé' : ''}`} aria-label="Budget consommé"
      >
        <div className="gauge-fill" style={{ '--fill': shown }} />
      </div>
      <div className="gauge-foot">
        <p><strong>{money(total)}</strong> sur {money(budget)} {symbol}</p>
        <button type="button" className="link-btn" onClick={onEdit}>Modifier</button>
      </div>
    </section>
  );
}

export function BudgetSheet({ budget, currency, onSave, onClose }) {
  const [value, setValue] = useState(budget ? formatAmountInput(minorToInput(budget, currency), currency, { paste: true }).text : '');
  const [error, setError] = useState('');
  const field = useAmountField(value, setValue, currency);

  const submit = (e) => {
    e.preventDefault();
    const minor = value.trim() ? toMinor(value, currency) : 0;
    if (minor == null) return setError('Ce montant n’est pas valide.');
    if (minor > MAX_PRICE_MINOR) return setError('Ce montant est trop élevé.');
    if (minor === 0) return setError('Indiquez un budget supérieur à zéro.');
    onSave(minor);
  };

  return (
    <Sheet title="Budget de la liste" onClose={onClose} labelledBy="budget-title">
      <form className="sheet-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Montant maximum à dépenser</span>
          <div className="input-suffix">
            <input data-autofocus {...field} placeholder="0" enterKeyHint="done" onChange={(e) => { field.onChange(e); setError(''); }} />
            <em>{currencySymbol(currency)}</em>
          </div>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          {budget ? <button type="button" className="btn btn-quiet danger" onClick={() => onSave(0)}>Retirer</button> : <span />}
          <button type="submit" className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Sheet>
  );
}
