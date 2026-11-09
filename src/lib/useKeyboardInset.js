import { useEffect } from 'react';

/**
 * Clavier virtuel (iPhone surtout) : il recouvre la page sans la redimensionner.
 * On mesure sa hauteur via visualViewport et on l'expose en CSS :
 *   --kb  hauteur du clavier (0px s'il est fermé)
 *   --vvh hauteur réellement visible (absent si le clavier est fermé)
 *   .kb-open sur <html> quand le clavier est ouvert
 * Le champ actif est ramené dans la zone visible une fois le clavier affiché.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    let frame = 0;
    let timer = 0;

    const isField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    const reveal = () => {
      const el = document.activeElement;
      if (isField(el)) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const apply = () => {
      frame = 0;
      // Un pincement de zoom réduit aussi la zone visible : ce n'est pas un clavier.
      const inset = vv.scale > 1.01 ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const open = inset > 100;
      const was = root.classList.contains('kb-open');
      root.classList.toggle('kb-open', open);
      root.style.setProperty('--kb', open ? `${inset}px` : '0px');
      if (open) root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      else root.style.removeProperty('--vvh');
      if (open && !was) reveal();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
    const onFocusIn = (e) => {
      if (!isField(e.target)) return;
      clearTimeout(timer);
      timer = setTimeout(reveal, 350); // laisse l'animation du clavier se terminer
    };

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    document.addEventListener('focusin', onFocusIn);
    apply();
    return () => {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      root.classList.remove('kb-open');
      root.style.removeProperty('--kb');
      root.style.removeProperty('--vvh');
    };
  }, []);
}
