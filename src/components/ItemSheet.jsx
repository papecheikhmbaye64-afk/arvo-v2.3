import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { MAX_PRICE_MINOR } from '../lib/storage.js';
import { formatAmountInput, minorToInput, toMinor, currencySymbol } from '../lib/money.js';
import { useAmountField } from '../lib/useAmountField.js';

export default function ItemSheet({ item, currency, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.priceMinor ? formatAmountInput(minorToInput(item.priceMinor, currency), currency, { paste: true }).text : '');
  const [qty, setQty] = useState(item.qty);
  const [error, setError] = useState('');
  const priceField = useAmountField(price, setPrice, currency);

  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Donnez un nom à cet article.');
    const minor = price.trim() ? toMinor(price, currency) : 0;
    if (minor == null) return setError('Ce prix n’est pas valide.');
    if (minor > MAX_PRICE_MINOR) return setError('Ce prix est trop élevé.');
    onSave({ name: n, priceMinor: minor, qty });
  };

  return (
    <Sheet title="Modifier l’article" onClose={onClose} labelledBy="item-title">
      <form className="sheet-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Article</span>
          <input data-autofocus value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(''); }} enterKeyHint="next" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Prix à l’unité</span>
            <div className="input-suffix">
              <input {...priceField} placeholder="0" onChange={(e) => { priceField.onChange(e); setError(''); }} enterKeyHint="done" />
              <em>{currencySymbol(currency)}</em>
            </div>
          </label>
          <div className="field">
            <span id="qty-label">Quantité</span>
            <div className="stepper" role="group" aria-labelledby="qty-label">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Moins un"><Icon name="minus" size={18} /></button>
              <output aria-live="polite">{qty}</output>
              <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99} aria-label="Plus un"><Icon name="plus" size={18} /></button>
            </div>
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="button" className="btn btn-quiet danger" onClick={onDelete}><Icon name="trash" size={18} />Supprimer</button>
          <button type="submit" className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Sheet>
  );
}
