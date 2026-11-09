# ARVO

Une **liste de courses** dont le total se calcule seul (suppression par balayage), un **historique** des listes terminées avec les dépenses du mois, et un **convertisseur de devises** instantané. Français, mode clair et sombre, hors ligne, installable (PWA).

```bash
npm install
npm run dev        # http://localhost:5173 (même Wi-Fi : l'adresse réseau est affichée)
npm run build      # produit dist/
npm test           # tests : argent, parité CFA, taux, rayons
```

## Ce que fait l'appli
- **Courses** : nom + prix (optionnel) + quantité ; total en direct ; case « dans le panier » ; rayon reconnu automatiquement (Fruits & légumes, Boulangerie…) ; modification en touchant la ligne ; devise de la liste modifiable (les prix sont alors convertis, avec « Annuler »).
- **Historique** : « Terminer la liste » l'archive (annulable) et repart d'une liste vide ; l'onglet Historique montre les dépenses des six derniers mois (touchez un mois pour le détail, variation par rapport au mois précédent) et chaque liste terminée, que l'on peut déplier, **dupliquer** (les articles sont ajoutés à la liste en cours, annulable) ou supprimer (annulable). Les listes en autre devise sont converties au taux du jour dans le tableau de bord.
- **Suggestions** : en tapant un nom, les produits déjà achetés s'affichent avec leur dernier prix ; un toucher remplit le nom et le prix, il reste à valider.
- **Scan d'étiquette** (option, jamais obligatoire) : « Scanner » ouvre l'appareil photo (ou la galerie), lit le nom et le prix **sur l'appareil** (Tesseract.js, WebAssembly), puis préremplit un formulaire à vérifier. Rien n'est ajouté sans validation. Les codes-barres, références, poids, pourcentages et prix au kilo ou au litre ne sont jamais pris pour le prix ; si plusieurs prix sont lus, l'utilisateur choisit ; si la lecture est incertaine, le champ reste vide. Un prix lu dans une autre devise est converti au taux du jour (ou laissé vide si le taux manque).
- **Suppression** : balayage vers la gauche (seuil, fond rouge qui s'arme, vibration légère sur mobile), ou touche Suppr sur une ligne, ou bouton « Supprimer » dans la fiche de l'article. Toute suppression propose « Annuler » pendant 5 secondes ; les fiches se ferment aussi en glissant leur poignée vers le bas.
- **Devises** : deux devises au choix (recherche parmi ~160), montant saisi avec séparateurs automatiques, résultat immédiat, inversion en un geste, « utiliser le total de mes courses ».
- **Taux** : ExchangeRate-API (sans clé), cache 6 h, dernier relevé conservé hors ligne, jamais de valeur inventée. La parité fixe 1 € = 655,957 FCFA est appliquée localement : EUR ↔ XOF/XAF fonctionne sans réseau.
- **Thème** : suit le système ; le bouton soleil/lune force clair ou sombre (mémorisé).
- **Photos** : déposer les images dans `public/photos/` (`hero-market.jpg`, `hero-exchange.jpg`, `empty-basket.jpg`, `cat-<rayon>.jpg`) ; si un fichier manque, le fond d'origine reste.

## Structure
| Chemin | Rôle |
|---|---|
| `src/App.jsx` | état global, navigation par `#/courses` et `#/devises`, thème, notifications |
| `src/components/ShoppingList.jsx`, `SwipeRow.jsx`, `ItemSheet.jsx` | liste, geste de balayage, édition |
| `src/components/Converter.jsx`, `CurrencyPicker.jsx` | convertisseur et sélecteur de devise |
| `src/components/History.jsx` | tableau de bord mensuel, listes terminées, duplication |
| `src/lib/history.js` | archivage, totaux mensuels, suggestions (fonctions pures, testées) |
| `src/lib/useKeyboardInset.js` | hauteur du clavier virtuel (iPhone) exposée en CSS |
| `src/components/ScanSheet.jsx` | feuille de scan : prêt, analyse, résultat, lecture partielle, échec, ajouté |
| `src/lib/ocr.js` | moteur de lecture local : prépare l'image, lit en plusieurs passes, contre-vérifie les chiffres, libère tout |
| `src/lib/labelParser.js` | analyse du texte lu : nom, prix, devise, ambiguïtés (fonction pure, testée) |
| `scripts/copy-ocr-assets.mjs` | copie moteur + modèle français dans `public/ocr/` (lancé par `npm run dev` / `build`) |
| `scripts/make_test_labels.py` | génère des étiquettes de test (propres, de travers, floues, peu contrastées) |
| `src/lib/money.js` | montants en entiers (unités mineures), saisie et formats |
| `src/lib/fx.js` | taux, cache, parité CFA/euro |
| `src/lib/categories.js` | rayons et détection par mots entiers |
| `src/lib/storage.js` | persistance `localStorage` (clé conservée pour la compatibilité) |
| `src/styles/` | jetons clair/sombre, base, composants |
| `public/photos/` | photos à déposer |

Données stockées uniquement dans le navigateur (pas de compte, pas de synchronisation). L'historique est ajouté à l'objet existant (`history`, vide par défaut) : les données d'avant sont relues telles quelles. Les données historiques d’une autre édition ne sont pas reprises.

## Déployer
Site statique : `npm run build` puis publier `dist/` (Netlify : voir `netlify.toml`, Vercel, GitHub Pages). Le service worker exige HTTPS ou localhost.

Taux : ExchangeRate-API (https://www.exchangerate-api.com). Indicatifs, hors frais bancaires.

## Scan : confidentialité et limites

- La photo est décodée, réduite dans un canvas, lue puis libérée. Elle n'est ni envoyée, ni stockée (ni `localStorage`, ni IndexedDB, ni cache). Le moteur est arrêté à la fermeture de la feuille.
- Le moteur (≈ 4 Mo) et le modèle français (≈ 0,7 Mo) sont servis par l'appli (`/ocr/`) et chargés au premier scan ; le service worker les garde ensuite en cache. Le premier scan demande donc une connexion.
- L'appareil photo s'ouvre via `<input type="file" capture>` : le système gère l'autorisation ; si elle est refusée ou la prise de vue annulée, rien ne change et « Choisir une image » reste disponible.
- Mesures sur 56 étiquettes générées (`make_test_labels.py`), sans vraies photos de rayon : voir le compte rendu de livraison. À refaire sur de vraies étiquettes avant de communiquer sur la fiabilité.
