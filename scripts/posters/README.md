# Affiches des services

Les 9 affiches « street » qui suivent la souris sur la page Services
(`assets/img/services/poster-{id}.webp`, 640 x 800 px, affichées en 320 x 400)
sont générées par ce dossier. Le dossier `scripts/` n'est pas mis en ligne.

## Régénérer les affiches

Prérequis : Node 18 ou plus, et Playwright avec Chromium (une seule fois) :

```bash
npm i --no-save playwright
npx playwright install chromium
```

Puis, depuis la racine du site :

```bash
node scripts/posters/build-posters.mjs
```

Le script écrit les 9 fichiers WebP dans `assets/img/services/` et affiche le
poids de chacun. Si une affiche dépasse 70 Ko, la qualité est baissée
automatiquement jusqu'à passer sous la limite.

Options utiles :

| Option | Effet |
| --- | --- |
| `--only=site,seo` | ne refait que ces affiches |
| `--sheet=planche.png` | crée une planche 3 x 3 à la taille réelle d'affichage, pour relecture |
| `--png=dossier` | enregistre aussi les PNG pleine taille |
| `--quality=78` | qualité WebP de départ (78 par défaut) |
| `--max-kb=70` | poids maximal visé par fichier |

Si Playwright est déjà installé ailleurs, indiquez son chemin :
`PLAYWRIGHT_MODULE=/chemin/vers/node_modules/playwright node scripts/posters/build-posters.mjs`.

## Que modifier, et où

- **Textes** : rien à faire ici. Le grand mot (nom court), l'accroche, le
  badge et le pictogramme viennent de `assets/js/services.js`. Aucun prix
  n'apparaît : chaque affiche porte la mention « Sur devis gratuit »
  (`QUOTE` dans `build-posters.mjs`). Modifiez ce fichier, puis
  relancez la commande ci-dessus.
- **Mise en page d'une affiche** : `compositions.mjs` (une fonction par
  service, positions en pixels sur 640 x 800).
- **Briques graphiques** (papier déchiré, ruban adhésif, trame de points,
  coups de marqueur, stickers) : `elements.mjs`.
- **Polices, couleurs, styles communs** : `poster.html` (gabarit).
- **Nouveau service** : ajoutez une composition portant le même `id` que dans
  `services.js`, sinon le script le signale et passe au suivant.

## Règles de l'identité visuelle

- Palette uniquement : crème `#F4F0E8`, noir doux `#141414`, citron `#D4FF3A`,
  crème foncé `#E8E1D2`, gris chaud `#57524A`. Jamais de texte citron sur crème.
- Polices : Bebas Neue (titres) et Poppins, chargées depuis `assets/fonts/`.
- Pas de tiret long ni de demi-cadratin : le script refuse de générer une
  affiche qui en contient.
- Garder le grand mot lisible à 320 x 400 : vérifiez toujours la planche
  (`--sheet`) avant de mettre en ligne.
