import { useLayoutEffect, useEffect, useRef } from 'react';
import { formatAmountInput } from './money.js';

const isSep = (c) => c === ',' || c === '.';

function caretFor(text, sig) {
  if (sig <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) if (/[\d,]/.test(text[i]) && ++seen === sig) return i + 1;
  return text.length;
}

/**
 * Champ de montant guidé : séparateurs de milliers ajoutés pendant la saisie, curseur préservé.
 * Renvoie les props à étaler sur un <input>.
 */
export function useAmountField(value, setValue, code) {
  const ref = useRef(null);
  const caret = useRef(null);

  useLayoutEffect(() => {
    if (caret.current != null && ref.current && document.activeElement === ref.current) {
      try { ref.current.setSelectionRange(caret.current, caret.current); } catch { /* sans conséquence */ }
    }
    caret.current = null;
  });

  // Une autre devise a peut-être un autre nombre de décimales : on reformate.
  useEffect(() => {
    const t = formatAmountInput(value, code, { paste: true }).text;
    if (t !== value) setValue(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onChange = (e) => {
    let raw = e.target.value;
    let pos = e.target.selectionStart ?? raw.length;
    const type = e.nativeEvent.inputType || '';
    const grew = raw.length - value.length;
    const pasted = type === 'insertFromPaste' || type === 'insertFromDrop' || type === 'insertReplacementText' || grew > 1;

    // Effacer à côté d'un point de milliers : on supprime le chiffre voisin pour ne pas rester bloqué.
    if ((type === 'deleteContentBackward' || type === 'deleteContentForward') && grew === -1 && value[pos] === '.') {
      const at = type === 'deleteContentBackward' ? pos - 1 : pos;
      if (at >= 0 && at < raw.length && /\d/.test(raw[at])) {
        raw = raw.slice(0, at) + raw.slice(at + 1);
        if (type === 'deleteContentBackward') pos -= 1;
      }
    }
    let decimalIndex = -1;
    if (!pasted && grew === 1 && isSep(raw[pos - 1])) decimalIndex = pos - 1;

    const out = formatAmountInput(raw, code, pasted ? { paste: true } : { decimalIndex });
    const before = pasted ? out.sig : formatAmountInput(raw.slice(0, pos), code, { decimalIndex: decimalIndex >= 0 && decimalIndex < pos ? decimalIndex : -1 }).sig;
    caret.current = caretFor(out.text, Math.min(before, out.sig));
    setValue(out.text);
  };

  return { ref, value, onChange, inputMode: 'decimal', autoComplete: 'off', autoCorrect: 'off', spellCheck: false };
}
