import { useState } from 'react';

const BASE = import.meta.env.BASE_URL;
export const photoUrl = (name) => `${BASE}photos/${name}.jpg`;

/**
 * Photo posée sur un fond déjà beau (dégradé + icône). Si le fichier est absent ou illisible,
 * l'image disparaît et le fond reste : l'interface n'a jamais l'air cassée.
 */
export function Photo({ name, className = '', eager = false }) {
  const [state, setState] = useState('loading');
  if (state === 'error') return null;
  return (
    <img
      className={`photo ${state === 'ready' ? 'is-ready' : ''} ${className}`}
      src={photoUrl(name)}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setState('ready')}
      onError={() => setState('error')}
    />
  );
}

/** Bandeau photo décoratif : disparaît entièrement si l'image manque, sans laisser de trou. */
export function Banner({ name, className = '' }) {
  const [state, setState] = useState('loading');
  if (state === 'error') return null;
  return (
    <div className={`banner ${state === 'ready' ? 'is-ready' : ''} ${className}`} aria-hidden="true">
      <img src={photoUrl(name)} alt="" decoding="async" onLoad={() => setState('ready')} onError={() => setState('error')} />
    </div>
  );
}
