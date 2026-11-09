// Jauge budgétaire : seuils exacts. < 80 % vert · 80 % à 100 % orange · > 100 % rouge.
// Tout est calculé en unités mineures (entiers) : aucune erreur d'arrondi flottante sur les seuils.
export const WARN_AT = 0.8;

/** @returns {{ratio:number, fill:number, pct:number, level:'ok'|'warn'|'over', over:number}} */
export function budgetStatus(totalMinor, budgetMinor) {
  if (!(budgetMinor > 0)) return { ratio: 0, fill: 0, pct: 0, level: 'ok', over: 0 };
  const ratio = totalMinor / budgetMinor;
  // Comparaisons en entiers : 80 % pile = orange, 100 % pile = orange (pas encore dépassé).
  const level = totalMinor > budgetMinor ? 'over' : totalMinor * 5 >= budgetMinor * 4 ? 'warn' : 'ok';
  return {
    ratio,
    fill: Math.min(1, ratio),
    pct: Math.floor(ratio * 100),
    level,
    over: Math.max(0, totalMinor - budgetMinor)
  };
}
