# Librairies locales (`assets/vendor/`)

Aucune librairie n'est chargée depuis un CDN (RGPD). Versions installées :

| Librairie | Version | Fichiers | Licence |
|---|---|---|---|
| GSAP (+ ScrollTrigger, SplitText) | 3.15.0 | `assets/vendor/gsap/` (copie de `node_modules/gsap/dist/*.min.js`) | GSAP Standard « No Charge » |
| Lenis | 1.3.27 | `assets/vendor/lenis/lenis.min.js` | MIT |
| Three.js | r186 (0.186.1) | `assets/vendor/three/three-hero.min.js` | MIT |
| Matter.js | 0.20.0 | `assets/vendor/matter/matter.min.js` | MIT |

## Three.js : paquet allégé

Three.js n'est plus livré minifié. `three-hero.min.js` ne contient que les classes utilisées par le hero WebGL (liste dans `three-hero.entry.js`). Pour le recompiler :

```bash
npm i -D three@0.186.1 esbuild
npx esbuild scripts/vendor/three-hero.entry.js --bundle --minify --format=esm \
  --target=es2020 --legal-comments=eof --outfile=assets/vendor/three/three-hero.min.js
```

## Mettre à jour une librairie

```bash
npm pack gsap@<version>      # puis copier dist/gsap.min.js, ScrollTrigger.min.js, SplitText.min.js
npm pack lenis@<version>     # puis copier dist/lenis.min.js
npm pack matter-js@<version> # puis copier build/matter.min.js
```
