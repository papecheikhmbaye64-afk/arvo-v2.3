import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import ShoppingList from './components/ShoppingList.jsx';
import Converter from './components/Converter.jsx';
import History from './components/History.jsx';
import Toast from './components/Toast.jsx';
import { createFx } from './lib/fx.js';
import { formatAmountInput, minorToInput } from './lib/money.js';
import { itemsTotal, load, save } from './lib/storage.js';
import { useKeyboardInset } from './lib/useKeyboardInset.js';

const fx = createFx();
const ROUTES = { courses: 'Mes courses', historique: 'Historique', devises: 'Convertisseur' };
const EYEBROWS = { historique: 'Vos dépenses', devises: 'Taux du jour' };
const routeFromHash = () => { const r = location.hash.replace(/^#\/?/, ''); return r in ROUTES ? r : 'courses'; };

const dateLabel = () => {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function useTheme(pref, setPref) {
  const [system, setSystem] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = (e) => setSystem(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const theme = pref || (system ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17191c' : '#eef1f3');
  }, [theme]);
  return [theme, () => setPref(theme === 'dark' ? 'light' : 'dark')];
}

export default function App() {
  const [state, setState] = useState(load);
  const [route, setRoute] = useState(routeFromHash);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ name: '', price: '' }); // article en cours de saisie (non enregistré)
  const [fxTick, setFxTick] = useState(0);
  const toastId = useRef(0);

  const patch = useCallback((p) => setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })), []);
  const [theme, toggleTheme] = useTheme(state.theme, (t) => patch({ theme: t }));
  useKeyboardInset();

  useEffect(() => { save(state); }, [state]);

  useEffect(() => {
    const onHash = () => { setRoute(routeFromHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    const off = fx.subscribe(() => setFxTick((n) => n + 1));
    const onOnline = () => fx.refresh(true);
    const onVisible = () => { if (!document.hidden) fx.refresh(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    fx.refresh();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
    return () => { window.removeEventListener('hashchange', onHash); off(); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const showToast = useCallback((t) => setToast({ ...t, id: ++toastId.current }), []);
  // Référence stable : sinon le minuteur de la notification repartait à zéro à chaque saisie ou mise à jour des taux.
  const dismissToast = useCallback(() => setToast(null), []);
  const go = (r) => { location.hash = `#/${r}`; };
  const total = useMemo(() => itemsTotal(state.items), [state.items]);

  const goConvert = (minor) => {
    patch((s) => ({ conv: { ...s.conv, from: s.currency, to: s.conv.to === s.currency ? (s.currency === 'EUR' ? 'USD' : 'EUR') : s.conv.to, amount: formatAmountInput(minorToInput(minor, s.currency), s.currency, { paste: true }).text } }));
    go('devises');
  };

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <div className={`app ${state.totalHidden ? 'privacy-on' : ''}`}>
        <header className="topbar">
          <a className="brand" href="#/courses" aria-label="ARVO, accueil"><img className="brand-icon" src="icons/icon.svg" alt="" /></a>
          <div className="topbar-actions">
            {route !== 'courses' && <button type="button" className="icon-btn" onClick={() => patch({ totalHidden: !state.totalHidden })} aria-label={state.totalHidden ? 'Afficher les montants' : 'Masquer les montants'} aria-pressed={state.totalHidden} title={state.totalHidden ? 'Afficher les montants' : 'Masquer les montants'}>
              <Icon name={state.totalHidden ? 'eyeOff' : 'eye'} size={19} />
            </button>}
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>
          </div>
        </header>

        <main id="main" className="screen" key={route}>
          <div className="screen-head">
            <p className="eyebrow">{route === 'courses' ? dateLabel() : EYEBROWS[route]}</p>
            <h1>{ROUTES[route]}</h1>
          </div>
          {route === 'courses' && <ShoppingList state={state} patch={patch} fx={fx} toast={showToast} goConvert={goConvert} draft={draft} setDraft={setDraft} />}
          {route === 'historique' && <History state={state} patch={patch} fx={fx} toast={showToast} go={go} />}
          {route === 'devises' && <Converter state={state} patch={patch} fx={fx} hidden={state.totalHidden} listTotal={{ minor: total, currency: state.currency }} />}
        </main>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />

      <nav className="tabbar" aria-label="Navigation principale">
        <a href="#/courses" className={route === 'courses' ? 'is-active' : ''} aria-current={route === 'courses' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('courses'); }}>
          <Icon name="basket" size={22} /><span>Courses</span>
        </a>
        <a href="#/historique" className={route === 'historique' ? 'is-active' : ''} aria-current={route === 'historique' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('historique'); }}>
          <Icon name="history" size={22} /><span>Historique</span>
        </a>
        <a href="#/devises" className={route === 'devises' ? 'is-active' : ''} aria-current={route === 'devises' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('devises'); }}>
          <Icon name="swap" size={22} /><span>Devises</span>
        </a>
      </nav>
    </>
  );
}
