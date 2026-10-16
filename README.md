# GJS — Site de l'agence (marketing digital & communication)

Site statique complet, sans build : HTML5 sémantique, CSS (custom properties, aucun framework), JavaScript en modules ES natifs.
Librairies épinglées via CDN (avec empreintes SRI) : **GSAP 3.13.0** (ScrollTrigger, SplitText, Flip, CustomEase), **Lenis 1.3.26**, **Barba.js 2.10.3**. Mini-jeux en **Canvas 2D** natif.

> Les seuls contenus provisoires sont les **médias** (images, vidéo) et les **textes signalés `[À REMPLACER]`** (étiquette visible en bleu dans les pages). Rien d'autre n'est un placeholder.

---

## 1. Lancer en local

```bash
npx serve .            # puis http://localhost:3000
# ou
python3 -m http.server 8000
```

Le fichier `serve.json` désactive les « clean URLs » de `serve` pour que les liens `offres.html`, `contact.html`… restent identiques en local et en production.
Une connexion internet est nécessaire (librairies jsDelivr et polices Fontshare) — voir §7 pour tout auto-héberger.

La page `404.html` utilise des chemins absolus (`/assets/…`) : elle doit être servie à la racine du domaine (comportement par défaut de Netlify, Vercel, `serve`, Apache avec `ErrorDocument 404 /404.html`, etc.).

---

## 2. Direction artistique (moodboard)

1. Nuit profonde : bleu nuit `#060B1E` → noir → blanc cassé `#F2F1EC`, le `body` change de teinte au scroll.
2. Un seul signal lumineux, `#5B85FF`, réservé aux glows, focus et états actifs (< 5 % de la surface).
3. Typographie éditoriale massive (Clash Display, jusqu'à 22vw) contre micro-labels techniques en JetBrains Mono.
4. Un ou deux mots par titre en Instrument Serif italique : la tension sans / serif.
5. Grilles asymétriques, éléments qui débordent, rotations de 2-4°, numérotation `[01] — …`.
6. Le vaisseau GJS comme fil rouge : loader, transitions, trajectoire de la méthode, succès du formulaire, 404, easter eggs.
7. Matière : grain SVG à 8 fps sur tout le site, scanlines CRT dans l'Arcade.
8. Motion à easing expo, reveals masqués ligne par ligne, images révélées par clip-path, parallaxe à 3 profondeurs.
9. Le jeu comme preuve : chaque mini-jeu se termine sur un message de conversion.
10. Zéro template : pas de cartes ombrées en grille de 3, pas de gradient « IA », pas d'icônes décoratives.

---

## 3. Arborescence

```
/index.html  /offres.html  /a-propos.html  /contact.html
/mentions-legales.html  /politique-confidentialite.html  /404.html
/robots.txt  /sitemap.xml  /site.webmanifest  /favicon.svg  /serve.json
/assets/css/   tokens.css · base.css · layout.css · components.css · games.css (chargé à la demande)
               pages/ home.css · offres.css · about.css · contact.css · legal.css · error.css
/assets/js/    main.js (bootstrap, Barba, cycle de vie) · config.js (CONFIG central) · easter-egg.js
               core/  loader · cursor · transitions · scroll · splitText · magnetic · marquee · menu · cookies
                      reveal (reveals & thèmes) · scope (anti-fuite) · head (sync <head>) · footer · cta
                      accordion · grid (touche G) · utils
               pages/ home · offres · about · contact · legal · error   (chargés à la demande)
               games/ arcade (coque) · button-game · race-game · maze-game · ship-hunt · utils
/assets/img/   placeholders AVIF + WebP (srcset), og-image.jpg, icons/
/assets/video/ hero.mp4 · hero.webm · hero-poster.jpg
/assets/fonts/ Instrument Serif Italic + JetBrains Mono (OFL, auto-hébergées)
```

### Cycle de vie des pages

Chaque module de `pages/` exporte `{ init(scope, container), intro(scope, container, tl), destroy() }`.
`main.js` crée un **scope** par page (`core/scope.js`) qui regroupe un `gsap.context`, un `gsap.matchMedia`, les écouteurs, observers, intervalles et boucles : tout est détruit d'un appel à la sortie de page (hook Barba `afterLeave`). Vérifié : après 10 navigations Barba, le nombre de ScrollTriggers et de tweens actifs revient exactement à la même valeur pour chaque page.

### Attributs pilotant les animations (sans JS spécifique)

| Attribut | Effet |
|---|---|
| `data-split="lines\|chars"` | Reveal de texte masqué (SplitText, lisible par les lecteurs d'écran) |
| `data-reveal="fade\|stagger\|image\|line"` | Fondu, cascade d'enfants, image par clip-path + scale, trait |
| `data-intro` + `data-delay` | Joué à l'entrée de page (après loader / rideau) au lieu du scroll |
| `data-parallax="0.15"` | Parallaxe (profondeur, négatif = sens inverse) |
| `data-counter="140"` (+ `data-prefix`, `data-suffix`, `data-decimals`) | Compteur animé |
| `data-theme="night\|black\|paper\|deep"` | Couleur du body quand la section passe au centre |
| `data-magnetic="0.35"` (+ `data-magnetic-radius`, `[data-magnetic-inner]`) | Élément magnétique |
| `data-marquee` (+ `data-speed`, `data-direction`) | Marquee réactif à la vélocité du scroll |
| `data-cursor="view\|play\|drag\|game"` (+ `data-cursor-label`) | État du curseur custom |
| `data-launch-game="button\|race\|maze"` | Ouvre un jeu de l'Arcade |
| `data-config="email\|phone\|booking\|availability"`, `data-social="LinkedIn"` | Synchronisé avec `CONFIG` |

---

## 4. Plan de build suivi

1. **Fondations** — tokens, typos, grille 12/6/4, grain, Lenis + ticker GSAP, Barba avec init/destroy.
2. **Loader + hero** — champ d'étoiles canvas, vaisseau SVG, « GJS » révélé dans le sillage, compteur calé sur le chargement réel, hyperespace, flash, volets ; vidéo hero qui se rétrécit en carte.
3. **Navigation** — header masqué/réaffiché au scroll, menu plein écran avec aperçu, curseur, transition rideau + vaisseau.
4. **Accueil** — manifeste au scrub, services horizontaux épinglés (empilés sur mobile), marquees, mosaïque projets + panneau Flip, chiffres, trajectoire de méthode, Arcade, carrousel draggable, CTA, footer.
5. **Offres** (pile sticky, timeline épinglée, configurateur), **À propos** (G·J·S, équipe, valeurs, timeline, coulisses Flip), **Contact** (formulaire 4 étapes).
6. **Arcade** — 3 jeux.
7. **Easter eggs**.
8. **Passe qualité** — responsive, accessibilité (axe-core), RGPD, SEO, performance (Lighthouse).
9. **Recette** — voir §10.

---

## 5. Médias à remplacer

Toutes les images sont servies en `<picture>` : **AVIF** puis **WebP**, avec `srcset` et `width`/`height`. Pour chaque base ci-dessous, fournir un fichier par largeur et par format, nommé `base-LARGEUR.avif` / `base-LARGEUR.webp` (ou `base.avif` / `base.webp` quand une seule largeur est listée). Les visuels actuels sont des compositions génératives marquées `[À REMPLACER]`.

Pensez à mettre à jour les attributs `alt` dans le HTML (ils décrivent déjà le contenu attendu).

### Vidéo hero

| Fichier | Format | Specs recommandées |
|---|---|---|
| `assets/video/hero.mp4` | H.264 (MP4) | 1920×1080, 10-15 s en boucle parfaite, CRF 26, `-movflags +faststart`, **sans audio**, < 4 Mo |
| `assets/video/hero.webm` | VP9 (WebM) | Mêmes specs, `-b:v 0 -crf 38` environ, < 3 Mo |
| `assets/video/hero-poster.jpg` | JPEG | 1920×1080 (1re image de la vidéo), ≤ 150 Ko — sert aussi de repli (autoplay bloqué, économie de données, mouvement réduit) |

```bash
ffmpeg -i source.mov -t 12 -vf "scale=1920:-2" -an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart assets/video/hero.mp4
ffmpeg -i source.mov -t 12 -vf "scale=1920:-2" -an -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 assets/video/hero.webm
ffmpeg -i assets/video/hero.mp4 -frames:v 1 -q:v 3 assets/video/hero-poster.jpg
```

Le bouton « Son » bascule `muted` : il n'a d'effet que si votre vidéo contient une piste audio.

### Images

| Fichier (base) | Dimensions natives | Largeurs générées | Poids cible (par fichier WebP le plus large) | Contenu attendu |
|---|---|---|---|---|
| `service-site` | 1200×1500 | 600 / 1200 | ≤ 140 Ko | Maquettes d’un site web responsive affichées sur ordinateur et mobile |
| `service-automatisation` | 1200×1500 | 600 / 1200 | ≤ 140 Ko | Schéma de workflow reliant un CRM, une boîte mail et un tableau de bord |
| `service-ads` | 1200×1500 | 600 / 1200 | ≤ 140 Ko | Tableau de bord de performances publicitaires en hausse |
| `service-ia` | 1200×1500 | 600 / 1200 | ≤ 140 Ko | Interface d’un agent conversationnel qui qualifie une demande client |
| `service-social` | 1200×1500 | 600 / 1200 | ≤ 140 Ko | Grille de publications Instagram d’une marque |
| `projet-01` | 1600×2000 | 800 / 1600 | ≤ 180 Ko (WebP 1600 px) | Page d’accueil du site e-commerce du projet Atlas |
| `projet-02` | 1600×1067 | 800 / 1600 | ≤ 180 Ko (WebP 1600 px) | Tableau de bord logistique automatisé du projet Borealis |
| `projet-03` | 1200×1500 | 800 / 1200 | ≤ 140 Ko | Visuels publicitaires de la campagne Cassiopée |
| `projet-04` | 1600×1200 | 800 / 1600 | ≤ 180 Ko (WebP 1600 px) | Grille de contenus social media du projet Draco |
| `projet-05` | 1600×1067 | 800 / 1600 | ≤ 180 Ko (WebP 1600 px) | Agent IA de qualification de leads du projet Eridan |
| `projet-06` | 1200×1600 | 800 / 1200 | ≤ 140 Ko | Site vitrine animé du projet Fornax |
| `manifeste-01` | 480×480 | 480 | ≤ 60 Ko |  |
| `manifeste-02` | 480×480 | 480 | ≤ 60 Ko |  |
| `manifeste-03` | 480×480 | 480 | ≤ 60 Ko |  |
| `offres-surmesure` | 1200×1500 | 600 / 1200 | ≤ 140 Ko | Atelier de cadrage : post-its, schémas et maquettes sur une table |
| `equipe-01` | 900×1200 | 450 / 900 | ≤ 90 Ko | Portrait de Prénom Nom, Fondateur — Stratégie & SEO |
| `equipe-02` | 900×1200 | 450 / 900 | ≤ 90 Ko | Portrait de Prénom Nom, Lead développeuse — Web & IA |
| `equipe-03` | 900×1200 | 450 / 900 | ≤ 90 Ko | Portrait de Prénom Nom, Head of Ads — Acquisition |
| `equipe-04` | 900×1200 | 450 / 900 | ≤ 90 Ko | Portrait de Prénom Nom, Directrice de création — Social |
| `coulisses-01` | 1000×1250 | 500 / 1000 | ≤ 90 Ko | Atelier de stratégie autour d’un grand mur de post-its |
| `coulisses-02` | 1200×800 | 600 / 1200 | ≤ 140 Ko | Écrans de développement avec du code et un prototype |
| `coulisses-03` | 1000×1250 | 500 / 1000 | ≤ 90 Ko | Séance photo produit pour un client |
| `coulisses-04` | 1200×800 | 600 / 1200 | ≤ 140 Ko | Réunion d’équipe autour d’un tableau de bord |
| `coulisses-05` | 1200×800 | 600 / 1200 | ≤ 140 Ko | Tournage d’une vidéo courte pour les réseaux sociaux |
| `coulisses-06` | 1000×1250 | 500 / 1000 | ≤ 90 Ko | Détail d’un carnet de croquis UX |
| `coulisses-07` | 1000×1250 | 500 / 1000 | ≤ 90 Ko | Plan de travail avec maquettes imprimées |
| `coulisses-08` | 1200×800 | 600 / 1200 | ≤ 140 Ko | L’équipe GJS dans les locaux à Paris |
| `about-01` | 900×1200 | 450 / 900 | ≤ 90 Ko |  |
| `about-02` | 900×1200 | 450 / 900 | ≤ 90 Ko |  |
| `menu-accueil` | 640×800 | 640 | ≤ 60 Ko | Aperçu menu — accueil |
| `menu-offres` | 640×800 | 640 | ≤ 60 Ko | Aperçu menu — offres |
| `menu-a-propos` | 640×800 | 640 | ≤ 60 Ko | Aperçu menu — a-propos |
| `menu-contact` | 640×800 | 640 | ≤ 60 Ko | Aperçu menu — contact |
| `menu-arcade` | 640×800 | 640 | ≤ 60 Ko | Aperçu menu — arcade |
Commande type pour produire les deux formats aux bonnes largeurs (exemple avec [sharp-cli](https://www.npmjs.com/package/sharp-cli)) :

```bash
npx sharp-cli -i projet-01.jpg -o assets/img/projet-01-1600.avif resize 1600 -f avif -q 50
npx sharp-cli -i projet-01.jpg -o assets/img/projet-01-1600.webp resize 1600 -f webp -q 72
# … idem en 800 px
```

### Autres fichiers

| Fichier | Format / dimensions | Rôle |
|---|---|---|
| `assets/img/og-image.jpg` | JPEG 1200×630, ≤ 200 Ko | Partage réseaux sociaux (Open Graph / Twitter) |
| `favicon.svg` | SVG carré | Favicon (le « G » + point signal actuel peut être conservé) |
| `assets/img/icons/apple-touch-icon.png` | PNG 180×180 | iOS |
| `assets/img/icons/icon-192.png`, `icon-512.png` | PNG | Manifeste PWA |
| `assets/img/icons/icon-maskable-512.png` | PNG 512×512, logo dans les 80 % centraux | Icône « maskable » Android |

---

## 6. Textes à remplacer

Recherchez `[À REMPLACER]` dans les fichiers HTML : chaque bloc concerné porte une étiquette visible.

| Où | Quoi |
|---|---|
| Accueil — Projets | 6 projets fictifs (« Projet Atlas »… « Projet Fornax ») : nom, client, année, problème, solution, KPI |
| Accueil — Chiffres | 4 statistiques (+140 %, ×3,2, 12 h, 0,9 s) — **à remplacer par des chiffres réels et vérifiables** |
| Accueil — Témoignages | 4 citations, noms et fonctions |
| Offres — Mini-cas | 1 chiffre + contexte par expertise |
| À propos | Équipe (4 portraits), trajectoire 2021-2026, coulisses, « Paris, depuis 2022 » |
| Contact | Lien de prise de rendez-vous (`CONFIG.BOOKING_URL`) |
| Mentions légales | Raison sociale, forme, capital, adresse, RCS, SIRET, TVA, directeur de publication, hébergeur, crédits photo |
| Confidentialité | Coordonnées du responsable, DPO, sous-traitants (hébergeur, formulaire, mesure d'audience), date de mise à jour |
| Accroche hero | Commentaire `<!-- [À REMPLACER] accroche principale -->` (texte du brief) |

Les textes juridiques sont une base structurée conforme au RGPD et aux recommandations CNIL ; faites-les valider avant mise en ligne.

---

## 7. Configuration (`assets/js/config.js`)

| Clé | Rôle | Valeur par défaut |
|---|---|---|
| `SITE_URL` | Domaine de production | `https://www.gjs-agence.fr` |
| `EMAIL`, `PHONE`, `PHONE_HREF`, `ADDRESS` | Coordonnées, synchronisées sur tous les éléments `[data-config]` | exemples |
| `LOCATION` | Ville, coordonnées, fuseau de l'horloge du footer | Paris, `Europe/Paris` |
| `FORM_ENDPOINT` | URL de réception du formulaire (POST JSON) — vide = repli mailto | `''` |
| `BOOKING_URL` | Lien de rendez-vous | `https://cal.com/` |
| `SOCIALS` | Réseaux `{ label, url }` ; supprimer une ligne masque le lien | LinkedIn, Instagram, TikTok |
| `PROMO_CODE` | Code débloqué par le mode Hyperespace | `HYPERGJS` |
| `AVAILABILITY` | Statut affiché dans le hero et sur Contact | « Disponible pour nouveaux projets » |
| `LOADER` | Durées du loader (`min` 2,5 s, `max` 4 s, `short` 1 s) | |
| `ANALYTICS` | Script de mesure chargé **uniquement après consentement** : `{ src, attrs }` | `null` |
| `CONSENT_VERSION` | À incrémenter quand un traceur est ajouté (le choix est redemandé) | `1` |
| `CONSENT_MAX_AGE_DAYS` | Validité du choix cookies | `182` (6 mois, CNIL) |

**Le contenu doit rester dans le HTML pour le SEO** : après avoir changé l'email, le téléphone, les réseaux ou le domaine dans `CONFIG`, faites aussi un rechercher/remplacer dans les `*.html`, `sitemap.xml` et `robots.txt` (`bonjour@gjs-agence.fr`, `+33 1 00 00 00 00`, `https://www.gjs-agence.fr`).

Exemple de mesure d'audience respectueuse :

```js
ANALYTICS: { src: 'https://plausible.io/js/script.js', attrs: { 'data-domain': 'gjs-agence.fr' } },
```

---

## 8. Connecter le formulaire de contact

Le formulaire envoie un `POST` JSON (`Content-Type: application/json`, `Accept: application/json`) vers `CONFIG.FORM_ENDPOINT`, avec un délai maximal de 12 s. Toute réponse `2xx` affiche l'écran de succès ; sinon un message d'erreur accessible propose de réessayer ou d'écrire par email (les réponses saisies sont conservées).

Données envoyées :

```json
{
  "besoins": ["site", "ia"], "objectif": "leads", "budget": "15-30k", "delai": "1-3-mois",
  "nom": "…", "email": "…", "entreprise": "…", "telephone": "…", "site": "https://…",
  "message": "…", "code": "HYPERGJS", "consentement": true,
  "page": "https://…/contact.html", "date": "2026-10-15T09:30:00.000Z", "_subject": "Nouveau projet — …"
}
```

- **Formspree** : créez un formulaire, copiez l'URL `https://formspree.io/f/xxxxxxx` dans `FORM_ENDPOINT`. Formspree accepte le JSON et utilise `_subject` comme objet du mail.
- **Make** : scénario « Webhooks › Custom webhook », copiez l'URL du webhook, puis enchaînez (email, CRM, Slack…).
- **n8n** : nœud « Webhook » (méthode POST, réponse 200), URL de production dans `FORM_ENDPOINT`. En cas de domaine différent, autorisez l'origine du site (CORS) dans n8n.

Sans endpoint configuré, l'envoi ouvre le client mail du visiteur avec la demande pré-remplie (vers `CONFIG.EMAIL`). Sans JavaScript, le formulaire reste visible en entier et part en `mailto:`.

Protection anti-spam : champ piège `website` (honeypot) — s'il est rempli, rien n'est envoyé. Le consentement RGPD est obligatoire et jamais pré-coché.

**Pré-remplissage** : le configurateur de « Nos offres » renvoie vers `contact.html?besoins=site,ia&horizon=urgent&objectif=leads` ; le mode Hyperespace vers `contact.html?code=HYPERGJS`. Les paramètres reconnus sont `besoins` (liste ou répétés), `objectif`, `horizon` / `delai`, `code`.

---

## 9. Polices, librairies et RGPD

- **Instrument Serif** (italique) et **JetBrains Mono** sont auto-hébergées (licence OFL incluse dans `assets/fonts/`) et préchargées.
- **Clash Display** et **General Sans** sont chargées depuis Fontshare (CSS asynchrone, `font-display: swap`). Pour un site 100 % sans transfert vers des tiers, téléchargez-les sur fontshare.com (licence ITF Free Font License), placez `ClashDisplay-Variable.woff2` et `GeneralSans-Variable.woff2` dans `assets/fonts/`, supprimez les deux balises Fontshare (et les `preconnect`) des pages, puis ajoutez dans `tokens.css` :

```css
@font-face { font-family: "Clash Display"; src: url("../fonts/ClashDisplay-Variable.woff2") format("woff2"); font-weight: 200 700; font-display: swap; }
@font-face { font-family: "General Sans"; src: url("../fonts/GeneralSans-Variable.woff2") format("woff2"); font-weight: 200 700; font-display: swap; }
```

- Les librairies JS viennent de jsDelivr avec intégrité SRI. Pour les auto-héberger, copiez les fichiers `dist/` des paquets npm `gsap@3.13.0`, `lenis@1.3.26`, `@barba/core@2.10.3` et remplacez les URL (les empreintes SRI restent valides, les fichiers sont identiques).
- **Bandeau cookies** sur-mesure : « Tout refuser », « Personnaliser » et « Tout accepter » ont le même poids visuel ; aucun script de mesure avant consentement ; choix conservé 6 mois ; lien « Gérer les cookies » dans le footer et sur la page Confidentialité. Les seuls stockages actifs par défaut sont fonctionnels (`gjs-consent`, `gjs-visited`, `gjs-arcade-*`) et listés dans la politique de confidentialité.

---

## 10. Recette — résultats mesurés

Tests automatisés (Playwright + Chromium) exécutés pendant le développement, librairies servies depuis des copies locales identiques aux fichiers CDN épinglés :

| Contrôle | Résultat |
|---|---|
| Erreurs console sur les 7 pages (chargement direct + défilement complet) | **0** |
| Loader complet (1re visite) / court (visites suivantes) / réduit | OK, « Passer l'intro » au clavier, annonce `aria-live`, scroll bloqué |
| Transitions Barba, titre et focus mis à jour, CSS de page chargée à la volée | OK |
| 10 navigations Barba consécutives | ScrollTriggers et tweens actifs identiques à chaque retour sur une page (pas de fuite) |
| Configurateur → Contact pré-rempli ; validation, erreurs accessibles, succès | OK |
| Arcade : 3 jeux jouables (clavier + pad tactile / balayage), pause, fin, record, CTA | OK |
| Easter eggs : Konami, « gjs », console, 7 clics footer | OK |
| `prefers-reduced-motion` | Lenis, parallaxe, distorsions coupés ; vidéo en pause ; loader ≈ 1 s ; fondus simples |
| Clavier : skip link, ordre de tabulation, focus piégé (menu, modales, jeux), Échap | OK |
| axe-core (WCAG 2.2 A/AA + bonnes pratiques) | 0 violation sur 6 pages ; sur l'accueil, seuls les mots du manifeste à 15 % d'opacité avant leur révélation au scroll (effet demandé, désactivé en mouvement réduit) |
| Lighthouse desktop (Accueil, Offres, À propos, Contact, Mentions) | **100 / 100 / 100 / 100** — LCP 0,5-0,6 s, CLS 0, TBT 0 ms |
| Lighthouse mobile (Accueil, CPU ×4, 4G lente) | 98 / 100 / 100 / 100 — LCP 2,3 s, CLS 0 |
| Rendu 360 → 2560 px, paysage mobile | Captures à 360, 390, 768, 1024, 1440, 2560 px et 844×390 (paysage) : aucun débordement horizontal, aucune erreur ; grilles 12/6/4, typographie géante conservée |

Limites connues de ces mesures : les polices Fontshare n'étaient pas joignables dans l'environnement de test (rendu avec la police de repli) et Lighthouse a été lancé en local ; refaites une mesure sur l'hébergement final avec les vrais médias.

---

## 11. Easter eggs (spoilers)

1. **Code Konami** ↑ ↑ ↓ ↓ ← → ← → B A : mode Hyperespace (warp 5 s, vaisseau, typos qui tremblent) puis modale secrète avec le code `HYPERGJS`.
2. Taper **« gjs »** hors d'un champ : le logo du header fait un tonneau avec traînée.
3. **Console** : logo ASCII et invitation à écrire.
4. **7 clics** sur le « GJS » géant du footer : défi caché — toucher le vaisseau 5 fois en 10 s.
5. Bonus studio : touche **G** (desktop) pour afficher la grille.
