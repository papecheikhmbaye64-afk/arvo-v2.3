// Rayons du magasin : détection automatique à partir du nom saisi.
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const CATEGORIES = [
  { id: 'produce', label: 'Fruits & légumes', words: ['tomate', 'oignon', 'ail ', 'carotte', 'salade', 'laitue', 'chou', 'aubergine', 'poivron', 'piment', 'gombo', 'concombre', 'courgette', 'patate', 'pomme de terre', 'igname', 'manioc', 'plantain', 'banane', 'mangue', 'orange', 'citron', 'pomme', 'poire', 'ananas', 'papaye', 'avocat', 'fraise', 'raisin', 'melon', 'pasteque', 'epinard', 'persil', 'menthe', 'gingembre', 'legume', 'fruit', 'haricot vert', 'champignon', 'mais'] },
  { id: 'bakery', label: 'Boulangerie', words: ['pain', 'baguette', 'croissant', 'brioche', 'gateau', 'biscuit', 'tarte', 'viennoiserie', 'pain de mie', 'beignet'] },
  { id: 'dairy', label: 'Crèmerie', words: ['lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'oeuf', 'œuf', 'mozzarella', 'emmental', 'lben', 'fromage blanc'] },
  { id: 'meat', label: 'Viandes & poissons', words: ['poulet', 'boeuf', 'bœuf', 'viande', 'mouton', 'agneau', 'poisson', 'thiof', 'capitaine', 'crevette', 'sardine', 'thon', 'saucisse', 'jambon', 'steak', 'dinde', 'merguez', 'filet', 'langouste', 'dorade'] },
  { id: 'pantry', label: 'Épicerie', words: ['riz', 'pates', 'spaghetti', 'huile', 'sucre', 'sel', 'farine', 'cafe', 'the ', 'mil', 'couscous', 'niebe', 'lentille', 'pois', 'tomate concentree', 'concentre', 'bouillon', 'cube', 'epice', 'moutarde', 'mayonnaise', 'confiture', 'miel', 'cereale', 'chocolat', 'conserve', 'sardines en boite', 'arachide', 'cacahuete', 'lait en poudre', 'attieke', 'semoule', 'vinaigre', 'ketchup', 'nutella'] },
  { id: 'drinks', label: 'Boissons', words: ['eau', 'jus', 'soda', 'coca', 'biere', 'vin', 'bissap', 'gingembre pressé', 'limonade', 'boisson', 'sirop', 'tisane', 'champagne', 'bouye', 'kinkeliba'] },
  { id: 'home', label: 'Maison', words: ['savon', 'lessive', 'javel', 'eponge', 'papier', 'mouchoir', 'dentifrice', 'shampoing', 'shampooing', 'deodorant', 'eau de javel', 'sac poubelle', 'poubelle', 'piles', 'ampoule', 'detergent', 'liquide vaisselle', 'brosse', 'coton', 'couche', 'serviette'] },
  { id: 'other', label: 'Autres', words: [] }
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

/**
 * Le mot qui apparaît en premier dans le nom l'emporte (en français, le nom de l'article vient d'abord :
 * « jus d'orange » = boisson, « eau de javel » = maison) ; à position égale, l'expression la plus longue
 * (« tomate concentrée » avant « tomate »). Mots entiers, pour qu'« eau » ne se trouve pas dans « gâteau ».
 */
export function guessCategory(name) {
  const n = ` ${norm(name).replace(/['’`´]/g, ' ')} `;
  let best = null;
  for (const c of CATEGORIES) {
    for (const w of c.words) {
      const k = norm(w).trim();
      const m = new RegExp(`(^|[^a-z])(${k}s?)(?=[^a-z]|$)`).exec(n);
      if (!m) continue;
      const pos = m.index + m[1].length;
      if (!best || pos < best.pos || (pos === best.pos && k.length > best.len)) best = { id: c.id, pos, len: k.length };
    }
  }
  return best ? best.id : 'other';
}
