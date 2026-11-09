const PATHS = {
  basket: 'M4 9h16l-1.4 9.2A2 2 0 0 1 16.6 20H7.4a2 2 0 0 1-2-1.8L4 9Zm4-1 3-4m5 4-3-4M9.5 13v3m5-3v3',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9ZM12 16a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z',
  image: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Zm0 9 4.5-4.5 3.5 3.5 2.5-2.5 5.5 5M9 9.5v.01',
  swap: 'M7 4 3.5 7.5 7 11M3.5 7.5H18M17 13l3.5 3.5L17 20m3.5-3.5H6',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z',
  trash: 'M4.5 7h15M9.5 7V4.8c0-.5.4-.8.8-.8h3.4c.4 0 .8.3.8.8V7M6.5 7l.8 11.2c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8L17.5 7M10 11v5m4-5v5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'm5 12.5 4.2 4.2L19 7',
  chevron: 'm7 10 5 5 5-5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2.5-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  eye: 'M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'm3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.7M6.2 6.2C3.8 7.9 2.5 12 2.5 12s3.4 6 9.5 6c1.1 0 2.1-.2 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.2a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  produce: 'M5 19c0-8 5-13 14-14 0 9-5 14-14 14Zm0 0 8-8',
  bakery: 'M5 10c0-2.5 3-4 7-4s7 1.5 7 4c0 1-.6 1.6-1.5 1.9V17a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-5.1C5.6 11.6 5 11 5 10Z',
  dairy: 'M8 3h8l2 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7l2-4Zm-2 4h12m-8 5h4',
  meat: 'M3 12c3-5 8-6 12-4l4-3v14l-4-3c-4 2-9 1-12-4Zm5.5-1.5v.01',
  pantry: 'M8 3h8v3H8V3Zm-1 3h10v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6Zm0 5h10',
  drinks: 'M10 3h4v4l2 3v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10l2-3V3Zm-2 10h8',
  home: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 13 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z',
  other: 'M6 8h12l1 12H5L6 8Zm3 0a3 3 0 0 1 6 0'
};

export default function Icon({ name, size = 22, stroke = 1.9, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] || PATHS.other} />
    </svg>
  );
}

/** Marque Tempo : trois barres de hauteurs différentes, comme un battement. */
export function Mark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="4.4" height="11" rx="2.2" fill="currentColor" />
      <rect x="9.8" y="3.5" width="4.4" height="16.5" rx="2.2" fill="currentColor" />
      <rect x="16.6" y="12" width="4.4" height="8" rx="2.2" fill="currentColor" />
    </svg>
  );
}
