import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { createEngine, readLabel, ScanError } from '../lib/ocr.js';
import { sameCurrency } from '../lib/labelParser.js';
import { MAX_PRICE_MINOR } from '../lib/storage.js';
import { convertMinor, currencySymbol, formatAmountInput, formatNumber, minorToInput, toMinor } from '../lib/money.js';
import { useAmountField } from '../lib/useAmountField.js';

const MAX_BYTES = 30 * 1024 * 1024; // une photo plus lourde ne se décode pas de façon fiable sur mobile

/** Prix lu -> montant dans la devise de la liste. missing = taux indisponible (on ne devine pas). */
function inListCurrency(p, currency, fx) {
  if (!p.currency || sameCurrency(p.currency, currency)) return { minor: p.minor, from: null, missing: false };
  const r = fx.rate(p.currency, currency);
  if (r == null) return { minor: null, from: p.currency, missing: true };
  return { minor: convertMinor(p.minor, p.currency, currency, r), from: p.currency, missing: false };
}
const toText = (minor, currency) => (minor ? formatAmountInput(minorToInput(minor, currency), currency, { paste: true }).text : '');
const priceLabel = (p) => (p.kind === 'unit' ? 'Au kilo ou au litre' : p.promo ? 'Prix promo' : 'Prix affiché');

function statusLine(parsed, missingFrom, symbol) {
  const noName = !parsed.name, noPrice = !parsed.priceId;
  if (missingFrom && parsed.priceId) return { tone: 'warn', text: `Prix lu en ${currencySymbol(missingFrom)}, taux indisponibles. Saisissez le montant en ${symbol}.` };
  if (!noName && !noPrice) return { tone: 'ok', text: 'Étiquette lue. Vérifiez, puis ajoutez.' };
  if (noName && noPrice && !parsed.prices.length) return { tone: 'warn', text: 'Lecture partielle. Complétez le nom et le prix.' };
  if (noPrice && parsed.prices.length > 1) return { tone: 'warn', text: noName ? 'Plusieurs prix lus. Choisissez le bon et complétez le nom.' : 'Plusieurs prix lus. Choisissez le bon.' };
  if (noPrice && parsed.prices.length === 1) return { tone: 'warn', text: noName ? 'Un prix au kilo ou au litre est lu. Confirmez-le et complétez le nom.' : 'Seul un prix au kilo ou au litre est lu. Confirmez-le ou saisissez le prix.' };
  if (noPrice) return { tone: 'warn', text: 'Prix non lu. Saisissez-le.' };
  return { tone: 'warn', text: 'Nom non lu. Complétez-le.' };
}

export default function ScanSheet({ currency, fx, total, onAdd, onClose, onManual }) {
  const [phase, setPhase] = useState('ready');          // ready | analyzing | result | failed | added
  const [progress, setProgress] = useState({ step: 'prepare', pct: null, loading: false });
  const [parsed, setParsed] = useState(null);
  const [failure, setFailure] = useState('empty');      // empty | engine | image
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(null);
  const [zoom, setZoom] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const engine = useRef(null);
  const run = useRef(0);
  const urlRef = useRef(null);
  const priceField = useAmountField(price, setPrice, currency);

  const getEngine = () => {
    if (!engine.current) {
      engine.current = createEngine({
        onProgress: (m) => setProgress((p) => (m.stage === 'read' ? { ...p, step: p.step === 'retry' ? 'retry' : 'read', pct: m.pct, loading: false } : { ...p, loading: true })),
      });
      engine.current.ready.catch(() => { engine.current = null; });
    }
    return engine.current;
  };
  const stopEngine = () => { const e = engine.current; engine.current = null; e?.terminate(); };
  const setPreviewFile = (file) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = file ? URL.createObjectURL(file) : null;
    setPreview(urlRef.current);
  };

  // Le moteur démarre dès l'ouverture : il est prêt quand la photo l'est. Tout est libéré à la fermeture.
  useEffect(() => {
    getEngine();
    return () => { run.current += 1; stopEngine(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPrice = (id, list = parsed?.prices) => {
    const p = list?.find((x) => x.id === id);
    setSelected(id);
    if (!p) { setPrice(''); return; }
    const c = inListCurrency(p, currency, fx);
    setPrice(c.missing ? '' : toText(c.minor, currency));
    setError('');
  };

  const analyse = async (file) => {
    const token = ++run.current;
    setError(''); setParsed(null); setZoom(false); setPreviewFile(file);
    setProgress({ step: 'prepare', pct: null, loading: false });
    setPhase('analyzing');
    const eng = getEngine();
    try {
      const out = await readLabel(eng, file, { currency, onStep: (step) => { if (token === run.current) setProgress((p) => ({ ...p, step, pct: step === 'read' || step === 'retry' ? 0 : null })); } });
      if (token !== run.current) return;
      setParsed(out);
      if (out.status === 'fail') { setFailure('empty'); setPhase('failed'); return; }
      setName(out.name);
      setSelected(out.priceId);
      const first = out.priceId ? out.prices.find((p) => p.id === out.priceId) : null;
      const c = first ? inListCurrency(first, currency, fx) : null;
      setPrice(c && !c.missing ? toText(c.minor, currency) : '');
      setPhase('result');
    } catch (e) {
      if (token !== run.current) return;
      setFailure(e instanceof ScanError ? e.kind : 'engine');
      setPhase('failed');
      if (!(e instanceof ScanError) || e.kind === 'engine') stopEngine();
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;                                   // appareil photo fermé sans photo : on reste où on est
    if ((file.type && !file.type.startsWith('image/')) || file.size > MAX_BYTES) { setFailure('image'); setPhase('failed'); return; }
    analyse(file);
  };

  const pickPhoto = () => cameraRef.current?.click();
  const pickFile = () => fileRef.current?.click();
  const cancel = () => { run.current += 1; stopEngine(); getEngine(); setPreviewFile(null); setPhase('ready'); };

  const selectedPrice = parsed?.prices.find((p) => p.id === selected) || null;
  const conv = selectedPrice ? inListCurrency(selectedPrice, currency, fx) : null;
  const minor = price.trim() ? toMinor(price, currency) : null;
  const canAdd = name.trim().length > 0 && minor != null && minor > 0 && minor <= MAX_PRICE_MINOR;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Donnez un nom à cet article.');
    if (minor == null || minor <= 0) return setError('Saisissez le prix de l’article.');
    if (minor > MAX_PRICE_MINOR) return setError('Ce prix est trop élevé.');
    onAdd(name.trim(), minor);
    setAdded({ name: name.trim(), minor, total: total + minor });
    setPreviewFile(null);
    setPhase('added');
  };

  const again = () => { setAdded(null); setParsed(null); setPhase('ready'); pickPhoto(); };
  const showChoices = parsed && parsed.prices.length > 0 && (parsed.prices.length > 1 || !parsed.priceId);
  const symbol = currencySymbol(currency);
  const status = parsed && phase === 'result' ? statusLine(parsed, conv?.missing ? conv.from : null, symbol) : null;

  const stepText = progress.loading && progress.step !== 'prepare'
    ? 'Démarrage du lecteur (première fois seulement)'
    : progress.step === 'prepare' ? 'Préparation de l’image'
      : progress.step === 'retry' ? 'Nouvel essai avec un autre contraste' : 'Lecture de l’étiquette';

  return (
    <Sheet title="Scanner un produit" onClose={onClose} labelledBy="scan-title">
      <div className="scan" data-phase={phase}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="scan-input" tabIndex={-1} aria-hidden="true" onChange={onFile} data-scan-input />
        <input ref={fileRef} type="file" accept="image/*" className="scan-input" tabIndex={-1} aria-hidden="true" onChange={onFile} />

        {phase === 'ready' && (
          <>
            <p className="scan-lead">Cadrez l’étiquette de prix, bien à plat. Le nom et le prix doivent être visibles.</p>
            <ul className="scan-tips">
              <li>Une seule étiquette par photo</li>
              <li>Évitez les reflets et le flou</li>
            </ul>
            <div className="scan-actions">
              <button type="button" className="btn btn-primary" data-autofocus onClick={pickPhoto}><Icon name="camera" size={20} />Prendre une photo</button>
              <button type="button" className="btn btn-soft" onClick={pickFile}><Icon name="image" size={20} />Choisir une image</button>
            </div>
            <p className="scan-privacy">La photo est lue sur votre appareil, puis effacée.</p>
          </>
        )}

        {phase === 'analyzing' && (
          <div className="scan-wait" role="status" aria-live="polite">
            {preview && <img className="scan-preview" src={preview} alt="Photo en cours d’analyse" />}
            <p className="scan-step">{stepText}</p>
            <div className="scan-bar" role="progressbar" aria-label="Analyse de la photo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct ?? undefined}>
              <span className={progress.pct == null ? 'is-wait' : ''} style={progress.pct == null ? undefined : { width: `${Math.max(6, progress.pct)}%` }} />
            </div>
            <button type="button" className="btn btn-quiet" onClick={cancel}>Annuler</button>
          </div>
        )}

        {phase === 'result' && parsed && (
          <form className="sheet-form scan-form" onSubmit={submit} noValidate>
            <div className={`scan-status is-${status.tone}`} role="status">
              {preview && (
                <button type="button" className="scan-thumb-btn" onClick={() => setZoom((z) => !z)} aria-expanded={zoom} aria-label={zoom ? 'Réduire la photo' : 'Agrandir la photo pour comparer'}>
                  <img className="scan-thumb" src={preview} alt="" />
                </button>
              )}
              <p>{status.text}</p>
            </div>
            {zoom && preview && <img className="scan-thumb is-lg" src={preview} alt="Photo de l’étiquette, agrandie" />}

            <label className="field">
              <span>Article</span>
              <input value={name} maxLength={60} placeholder="Nom du produit" onChange={(e) => { setName(e.target.value); setError(''); }} enterKeyHint="next" autoComplete="off" />
            </label>
            {!name && parsed.nameAlternatives.length > 0 && (
              <div className="scan-alts" aria-label="Texte lu sur l’étiquette">
                <span>Texte lu :</span>
                {parsed.nameAlternatives.map((t) => <button key={t} type="button" className="suggest" onClick={() => { setName(t); setError(''); }}><span>{t}</span></button>)}
              </div>
            )}

            {showChoices && (
              <div className="field">
                <span id="scan-price-choice">Choisissez le bon prix</span>
                <div className="scan-choices" role="radiogroup" aria-labelledby="scan-price-choice">
                  {parsed.prices.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={selected === p.id} className={`scan-choice ${selected === p.id ? 'is-on' : ''}`} onClick={() => applyPrice(p.id)}>
                      <strong>{formatNumber(p.minor, p.currency || currency)}<i>{currencySymbol(p.currency || currency)}</i></strong>
                      <small>{priceLabel(p)}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="field">
              <span>Prix à l’unité</span>
              <div className="input-suffix">
                <input {...priceField} placeholder="0" onChange={(e) => { priceField.onChange(e); setError(''); }} enterKeyHint="done" />
                <em>{symbol}</em>
              </div>
            </label>
            {conv?.from && !conv.missing && <p className="scan-note">Prix lu en {currencySymbol(conv.from)} ({formatNumber(selectedPrice.minor, conv.from)}), converti en {symbol} au taux du jour.</p>}
            {selectedPrice?.kind === 'unit' && <p className="scan-note">Ce prix est au kilo ou au litre, pas pour l’article entier.</p>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="scan-actions">
              <button type="submit" className="btn btn-primary" disabled={!canAdd}>Ajouter à la liste</button>
              <button type="button" className="btn btn-soft" onClick={pickPhoto}><Icon name="camera" size={20} />Reprendre une photo</button>
            </div>
          </form>
        )}

        {phase === 'failed' && (
          <div className="scan-fail" role="alert">
            {preview && failure === 'empty' && <img className="scan-thumb is-lg" src={preview} alt="Photo non lisible" />}
            <h3>{failure === 'engine' ? 'Le lecteur n’a pas pu démarrer' : failure === 'image' ? 'Cette image ne peut pas être lue' : 'Rien de lisible sur cette photo'}</h3>
            <p>
              {failure === 'engine' ? 'Vérifiez votre connexion pour le premier scan, puis réessayez. Vous pouvez aussi saisir le produit à la main.'
                : failure === 'image' ? 'Choisissez une photo (JPG, PNG ou HEIC) de moins de 30 Mo.'
                  : 'Rapprochez-vous, évitez les reflets et cadrez bien le nom et le prix.'}
            </p>
            <div className="scan-actions">
              <button type="button" className="btn btn-primary" onClick={pickPhoto}><Icon name="camera" size={20} />Réessayer</button>
              <button type="button" className="btn btn-soft" onClick={onManual}>Saisir à la main</button>
            </div>
          </div>
        )}

        {phase === 'added' && added && (
          <div className="scan-done" role="status">
            <span className="scan-check" aria-hidden="true"><Icon name="check" size={26} stroke={2.4} /></span>
            <h3>{added.name} ajouté</h3>
            <p>{formatNumber(added.minor, currency)} {symbol} · Total de la liste : <strong>{formatNumber(added.total, currency)} {symbol}</strong></p>
            <div className="scan-actions">
              <button type="button" className="btn btn-primary" data-autofocus onClick={again}><Icon name="camera" size={20} />Scanner un autre produit</button>
              <button type="button" className="btn btn-soft" onClick={onClose}>Terminer</button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
