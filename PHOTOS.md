# Photos de Tempo

Tempo affiche des photos à 11 endroits précis. **Aucune n'est incluse dans le projet** : déposez simplement vos images
dans `public/photos/` avec les noms ci-dessous. Tant qu'un fichier manque, l'interface reste complète (dégradé et pictogramme
à la place, bandeau masqué) ; dès qu'il est présent, la photo apparaît en fondu.

| Fichier | Où | Format conseillé |
|---|---|---|
| `hero-market.jpg` | bandeau de la carte « Total de la liste » | 1200 × 480 px, ≤ 120 Ko |
| `hero-exchange.jpg` | bandeau du convertisseur | 1200 × 480 px, ≤ 120 Ko |
| `empty-basket.jpg` | écran « Votre panier est vide » | 600 × 600 px, ≤ 80 Ko |
| `cat-produce.jpg` | vignette Fruits & légumes | 320 × 320 px, ≤ 25 Ko |
| `cat-bakery.jpg` | vignette Boulangerie | idem |
| `cat-dairy.jpg` | vignette Crèmerie | idem |
| `cat-meat.jpg` | vignette Viandes & poissons | idem |
| `cat-pantry.jpg` | vignette Épicerie | idem |
| `cat-drinks.jpg` | vignette Boissons | idem |
| `cat-home.jpg` | vignette Maison | idem |
| `cat-other.jpg` | vignette Autres | idem |

Les bandeaux sont recadrés au centre (`object-fit: cover`) : gardez le sujet au milieu et laissez de l'air sur les côtés.

## Prompts (à adapter à votre générateur d'images)

**Ligne de style commune**, à ajouter à chaque prompt pour garder une série cohérente :
> natural daylight, soft warm tones, shallow depth of field, shot on a 50mm lens, editorial food photography, matte finish, no text, no logos, no watermark, no hands, no people

- **hero-market** : Wide shot of a sunlit open-air market stall at golden hour: wicker crates of ripe tomatoes, mangoes, green leafy vegetables and red onions, linen cloth, blurred market background. Subject centred, empty space left and right. Landscape 5:2.
- **hero-exchange** : Flat lay on a pale wooden table in morning light: a woven tote bag, a small notebook, a few loose coins, sunglasses and a glass of water; calm, travel-day mood. Landscape 5:2. (Évitez les billets reconnaissables : les générateurs inventent de faux motifs.)
- **empty-basket** : A woven wicker basket on a light linen surface holding a baguette, two lemons, a bunch of herbs and a glass bottle of milk, top-down three-quarter view, soft shadow. Square.
- **cat-produce** : Close-up of fresh tomatoes, a cucumber and a bunch of herbs, top-down, square crop.
- **cat-bakery** : A freshly baked baguette and a round loaf on a flour-dusted wooden board, top-down, square crop.
- **cat-dairy** : A glass bottle of milk, a small wedge of cheese and a white ceramic pot of yoghurt on a pale surface, square crop.
- **cat-meat** : Raw chicken thighs and a whole silver fish on crushed ice with lemon slices and herbs, top-down, square crop.
- **cat-pantry** : Glass jars of rice, lentils and spices beside a small bottle of oil, on a rustic table, square crop.
- **cat-drinks** : A glass bottle of sparkling water and a tall glass of orange juice with ice, condensation, square crop.
- **cat-home** : A folded cotton cloth, a bar of soap and a small spray bottle on a pale surface, clean and airy, square crop.
- **cat-other** : A kraft paper shopping bag with a few items peeking out, soft light, square crop.

## Conseils
- Générez un peu plus grand, puis exportez en JPEG qualité 75–80 aux dimensions du tableau : l'appli reste légère et rapide hors ligne.
- Vérifiez chaque image à 46 px de côté (taille des vignettes) : un sujet unique et lisible vaut mieux qu'une scène chargée.
