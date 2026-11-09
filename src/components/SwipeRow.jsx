import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

const THRESHOLD = 104; // px à franchir pour valider la suppression

/**
 * Ligne que l'on supprime d'un balayage vers la gauche.
 * - le geste ne démarre qu'après un mouvement nettement horizontal : le défilement vertical reste libre ;
 * - un fond rouge se révèle sous la carte et « s'arme » au franchissement du seuil ;
 * - au relâchement : validation (la carte sort, la ligne se replie) ou retour élastique ;
 * - alternative sans geste : touche Suppr lorsqu'une ligne est sélectionnée.
 */
export default function SwipeRow({ children, onDelete, name }) {
  const fg = useRef(null);
  const drag = useRef(null);
  const swallow = useRef(false);
  const [x, setX] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | dragging | leaving | collapsing
  const armed = x <= -THRESHOLD;

  const commit = () => {
    if (phase === 'leaving' || phase === 'collapsing') return;
    const w = fg.current?.offsetWidth || 360;
    setPhase('leaving');
    setX(-w - 24);
    setTimeout(() => setPhase('collapsing'), 170);
    setTimeout(onDelete, 170 + 260);
  };

  const onPointerDown = (e) => {
    if (phase !== 'idle' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, active: false, lastX: e.clientX, lastT: e.timeStamp, v: 0, armed: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag.current = null; return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      d.active = true;
      try { fg.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      setPhase('dragging');
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX; d.lastT = e.timeStamp;
    // vers la gauche : suit le doigt, avec une légère résistance au-delà du seuil ; vers la droite : butée douce
    let nx = dx < 0 ? dx : dx * 0.12;
    if (nx < -THRESHOLD) nx = -THRESHOLD + (nx + THRESHOLD) * 0.55;
    const isArmed = nx <= -THRESHOLD;
    if (isArmed !== d.armed) { d.armed = isArmed; try { navigator.vibrate?.(isArmed ? 12 : 4); } catch { /* ignore */ } }
    setX(nx);
  };
  const end = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    swallow.current = true;
    setTimeout(() => { swallow.current = false; }, 0);
    if (e.type !== 'pointercancel' && (x <= -THRESHOLD || (d.v < -0.7 && x < -48))) commit();
    else { setPhase('idle'); setX(0); }
  };
  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget && e.target.tagName === 'INPUT') return;
    if (e.key === 'Delete') { e.preventDefault(); commit(); }
  };

  const progress = Math.min(1, Math.abs(x) / THRESHOLD);
  return (
    <li className={`swipe-wrap is-${phase}`}>
      <div className="swipe-clip">
        <div className="swipe" style={{ '--p': progress }} onKeyDown={onKeyDown}>
          <div className={`swipe-bg ${armed || phase === 'leaving' ? 'is-armed' : ''}`} aria-hidden="true">
            <Icon name="trash" size={22} />
            <span>Supprimer</span>
          </div>
          <div
            ref={fg}
            className={`swipe-fg ${phase === 'dragging' ? 'is-dragging' : ''}`}
            style={{ transform: x ? `translate3d(${x}px,0,0)` : undefined }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={end}
            onPointerCancel={end}
            onClickCapture={(e) => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); } }}
          >
            {children}
          </div>
        </div>
      </div>
    </li>
  );
}
