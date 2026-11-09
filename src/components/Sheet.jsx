import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

/** Feuille ancrée en bas : fermeture par Échap, clic à côté ou bouton ; le focus y entre et revient après. */
export default function Sheet({ title, onClose, children, labelledBy = 'sheet-title' }) {
  const panel = useRef(null);
  const drag = useRef(null);
  const [dy, setDy] = useState(0);

  // Glisser la poignée ou l'en-tête vers le bas ferme la feuille (la poignée le laisse entendre).
  const grab = {
    style: { touchAction: 'none' },
    onPointerDown: (e) => {
      if (e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag.current = { id: e.pointerId, sy: e.clientY };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    },
    onPointerMove: (e) => { if (drag.current?.id === e.pointerId) setDy(Math.max(0, e.clientY - drag.current.sy)); },
    onPointerUp: (e) => {
      if (drag.current?.id !== e.pointerId) return;
      const moved = Math.max(0, e.clientY - drag.current.sy);
      drag.current = null;
      if (moved > 90) onClose(); else setDy(0);
    },
    onPointerCancel: () => { drag.current = null; setDy(0); }
  };

  useEffect(() => {
    const prev = document.activeElement;
    const first = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector('input,button,select');
    first?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.({ preventScroll: true }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panel}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}>
        <div className="sheet-grip" aria-hidden="true" {...grab} />
        <header className="sheet-head" {...grab}>
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={20} /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}
