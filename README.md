# GJS · Site de l'agence

Site statique, sans framework et sans étape de build obligatoire : HTML sémantique, CSS en custom properties, JavaScript en modules natifs. **Aucune librairie externe, aucun appel à un service tiers** : polices et scripts sont hébergés avec le site.

---

## ⚠️ 1. BRANCHER LE FORMULAIRE DE CONTACT (à faire avant la mise en ligne)

Tant que `FORM_ENDPOINT` est vide, le formulaire **ouvre la messagerie du visiteur** avec la demande pré-remplie. Ça marche, mais vous perdez les visiteurs qui n'ont pas de messagerie configurée. Branchez un vrai récepteur :

### Option A : Formspree (le plus simple, 5 minutes)

1. Créez un compte sur [formspree.io](https://formspree.io) puis **New form**.
2. Copiez l'URL du formulaire, du type `https://formspree.io/f/abcdwxyz`.
3. Ouvrez **`assets/js/config.js`** et collez-la :
   ```js
   FORM_ENDPOINT: 'https://formspree.io/f/abcdwxyz',
   ```
4. Envoyez une demande de test depuis `contact.html`, puis validez l'email de confirmation que Formspree vous envoie.

Formspree accepte le JSON et utilise le champ `_subject` comme objet de l'email.

### Option B : Make (pour envoyer aussi vers un CRM, Slack, Google Sheets…)

1. Dans Make, créez un scénario qui commence par **Webhooks › Custom webhook**, puis **Add** pour générer l'URL.
2. Copiez l'URL (`https://hook.eu2.make.com/xxxxxxxx`) dans `FORM_ENDPOINT` (fichier `assets/js/config.js`).
3. Envoyez une demande de test depuis le site : Make détecte la structure des données.
4. Ajoutez les modules suivants (email, CRM, tableau…), puis un module **Webhook response** avec le statut `200`.

### Ce que le formulaire envoie

Requête `POST`, en-têtes `Content-Type: application/json` et `Accept: application/json`, délai maximum 12 s. Toute réponse `2xx` affiche l'écran de succès ; sinon un message propose de réessayer ou d'écrire par email (les réponses sont conservées).

```json
{
  "besoins": ["site", "seo"],
  "besoins_libelles": ["Création de site internet", "SEO (référencement naturel)"],
  "budget": "1000-3000", "budget_libelle": "1 000 à 3 000 €",
  "delai": "1-3-mois", "delai_libelle": "D’ici 1 à 3 mois",
  "nom": "…", "email": "…", "telephone": "…", "entreprise": "…", "message": "…",
  "consentement": true,
  "page": "https://www.gjs-agence.fr/contact.html", "date": "2026-10-16T09:30:00.000Z",
  "_subject": "Nouvelle demande de devis : …"
}
```

Le formulaire court de la page Services (`#demande`) utilise le même endpoint, les mêmes règles de validation, le même anti-spam et le même écran de succès (code commun : `assets/js/core/forms.js`). Il envoie le même JSON, avec `budget`, `delai` et `entreprise` vides.

Anti-spam : champ piège invisible (`website`). S'il est rempli, rien n'est envoyé. Le consentement RGPD est obligatoire et jamais pré-coché. Pensez à indiquer le prestataire choisi dans la politique de confidentialité (section 4).

---

## 2. Modifier un badge, un texte ou un service

**Tout est dans un seul fichier : `assets/js/services.js`.** Chaque service y a son nom, sa phrase de bénéfice, ses 3 points inclus, son badge, son délai indicatif et son détail (ce qu'on fait, ce que vous obtenez). **Aucun prix n'est affiché sur le site** : partout, la mention est « Sur devis gratuit ».

```js
badge: 'Le plus demandé',                        // sticker (laisser '' pour aucun)
featured: true,                                  // carte mise en avant (fond citron)
delay: '8 à 12 semaines',                        // délai indicatif (fiche du service)
```

Après modification, lancez :

```bash
npm run services        # ou : node scripts/sync-services.mjs   (Node 18+, aucune dépendance)
```

La commande réécrit, dans les pages HTML, tout ce qui se trouve entre les marqueurs `<!-- @services:… -->` : les cartes de l'accueil, l'index et le tour des services, les 9 fiches détaillées de la page Services, les choix des deux formulaires (Services et Contact), les stickers du footer et les données structurées (Service, OfferCatalog, sans prix). Le contenu reste donc **écrit dans le HTML** pour le SEO.

Filet de sécurité : si vous oubliez la commande, les badges **affichés** sont corrigés au chargement de la page. Mais Google verra l'ancien texte : lancez toujours la commande.

Les délais cités dans la FAQ de l'accueil sont écrits à la main dans `index.html` (et dans le JSON-LD FAQPage du `<head>`) : mettez-les à jour si vous changez les délais.

---

## 3. Lancer en local

```bash
npx serve .            # puis http://localhost:3000
# ou
python3 -m http.server 8000
```

`serve.json` désactive les « clean URLs » pour que `services.html`, `contact.html`… restent identiques en local et en production. La page `404.html` utilise des chemins absolus (`/assets/…`) : servez-la à la racine du domaine (comportement par défaut de Netlify, Vercel, `serve`, Apache avec `ErrorDocument 404 /404.html`).

---

## 4. Ce qu'il reste à fournir : tous les `[À REMPLACER]`

Les textes provisoires portent une étiquette visible en pointillés `[À REMPLACER]` (ou `[À PERSONNALISER]`). Recherchez-les dans les fichiers HTML.

| Où | Quoi |
|---|---|
| `assets/js/config.js` + HTML | **Endpoint du formulaire** (`FORM_ENDPOINT`, voir §1) |
| `assets/js/config.js` + HTML | **Téléphone** (`PHONE`, `PHONE_HREF`) : actuellement `01 00 00 00 00` |
| `assets/js/config.js` + HTML | **Numéro WhatsApp** (`WHATSAPP`) : actuellement `33600000000` |
| `assets/js/config.js` + `contact.html` | **Lien de prise de rendez-vous** (`BOOKING_URL`) : actuellement `https://cal.com/` |
| `assets/js/config.js` + HTML | Email (`bonjour@gjs-agence.fr`), domaine (`www.gjs-agence.fr`), liens Instagram, LinkedIn et TikTok (`SOCIALS`, actuellement les pages d'accueil des réseaux) |
| `a-propos.html` | **3 portraits** (aussi utilisés par l'intro G · J · S et la signature Vision), **3 prénoms et noms**, **3 rôles** ; « Notre histoire » à personnaliser ; Trajectoire : 6 dates et textes d'exemple repris du site de Gabin (« agence parisienne », « 50 projets livrés »…), à remplacer par votre vraie histoire |
| `assets/img/equipe/` | Photos : `associe-1-480.webp`, `associe-1-960.webp` (idem 2 et 3), format portrait **4:5**, 960×1200 px, ≤ 120 Ko |
| `mentions-legales.html` | Raison sociale, forme juridique et capital, siège, RCS, SIRET, TVA, directeur de la publication, hébergeur, crédits photo, date de mise à jour |
| `politique-confidentialite.html` | Coordonnées du responsable, DPO éventuel, hébergeur, outil de formulaire (Formspree ou Make), outil de mesure d'audience (et sa ligne dans le tableau des traceurs), outil de rendez-vous, transferts hors UE, date de mise à jour |
| `politique-cookies.html` | Date de mise à jour, fiche de l'outil de mesure d'audience s'il est activé, outil de rendez-vous (`[Cal.com]`) |
| `exercer-vos-droits.html` | Date de mise à jour, adresse postale du siège, DPO éventuel |
| `contact.html` | Bloc Rendez-vous : mention `[À REMPLACER : lien]` à retirer une fois `BOOKING_URL` renseigné |
| `index.html` (section masquée) | Réalisations : images, noms de clients et textes (voir §7) |
| `assets/img/services/` | **Facultatif** : 9 visuels des services pour le survol de l'index (page Services). Des affiches street générées sont en place (`poster-site.webp`…), à remplacer par vos photos ou visuels au même nom, format portrait **4:5**, 640×800 px, ≤ 70 Ko. Pour régénérer les affiches : `scripts/posters/README.md` |

> Après avoir changé l'email, le téléphone, WhatsApp, le lien de rendez-vous ou le domaine dans `config.js`, faites aussi un **rechercher/remplacer** dans les `*.html`, `sitemap.xml` et `robots.txt` : le JavaScript corrige l'affichage, mais le HTML doit être juste pour le SEO et pour les visiteurs sans JavaScript.

Commande pour convertir une photo (ImageMagick) :

```bash
convert portrait.jpg -resize 960x1200^ -gravity center -extent 960x1200 -quality 78 assets/img/equipe/associe-1-960.webp
convert portrait.jpg -resize 480x600^  -gravity center -extent 480x600  -quality 78 assets/img/equipe/associe-1-480.webp
```

---

## 5. Configuration (`assets/js/config.js`)

| Clé | Rôle |
|---|---|
| `SITE_URL` | Domaine de production (sans slash final) |
| `EMAIL`, `PHONE`, `PHONE_HREF` | Coordonnées, synchronisées sur tous les éléments `[data-config]` |
| `WHATSAPP`, `WHATSAPP_MESSAGE` | Numéro (format international, chiffres seuls) et message pré-rempli des boutons WhatsApp |
| `BOOKING_URL` | Lien de prise de rendez-vous (Calendly, Cal.com…) |
| `FORM_ENDPOINT` | URL de réception du formulaire (POST JSON). Vide = repli mailto |
| `SOCIALS` | Réseaux `{ label, url }` (Instagram, LinkedIn, TikTok : icônes du footer et du menu, adresses [À REMPLACER]) ; supprimer une ligne masque le lien partout |
| `ANALYTICS` | Script de mesure chargé **uniquement après consentement** : `{ src, attrs }` |
| `CONSENT_VERSION` | À incrémenter quand vous ajoutez un traceur (le choix est redemandé) |
| `CONSENT_MAX_AGE_DAYS` | Validité du choix cookies : 182 jours (6 mois, CNIL) |

Exemple de mesure d'audience respectueuse :

```js
ANALYTICS: { src: 'https://plausible.io/js/script.js', attrs: { 'data-domain': 'gjs-agence.fr' } },
```

---

## 6. Identité visuelle (à respecter)

**Palette stricte**, définie dans `assets/css/tokens.css` et utilisée partout via des variables :

| Token | Valeur | Usage |
|---|---|---|
| `--cream` | `#F4F0E8` | Fond |
| `--ink` | `#141414` | Texte, bordures, ombres |
| `--lime` | `#D4FF3A` | Fonds de boutons, stickers, surlignage, bandeaux |
| `--cream-2` | `#E8E1D2` | Dérivé : cartes, footer, ruban adhésif |
| `--ink-2` | `#57524A` | Dérivé : textes secondaires |

**Contrastes vérifiés** (seuil WCAG AA : 4,5:1) :

| Texte | Fond | Ratio |
|---|---|---|
| Noir | Crème | 16,2:1 |
| Noir | Crème foncé | 14,2:1 |
| Noir | Citron | 15,9:1 |
| Crème | Noir | 16,2:1 |
| Citron | Noir | 15,9:1 |
| Crème foncé | Noir | 14,2:1 |
| Gris chaud | Crème | 6,8:1 |
| Gris chaud | Crème foncé | 6,0:1 |
| Gris chaud | Citron | 6,7:1 |
| ~~Citron~~ | ~~Crème~~ | **1,02:1, interdit** |

**Règles** : jamais de texte citron sur crème ; le citron est un fond, avec du texte noir dessus. Au maximum **2 sections noires par page** (`class="section is-dark"`). Un seul coup de marqueur (`<span class="hl">mot</span>`) par titre important.

**Typographie** : 2 polices auto-hébergées (licence OFL, `assets/fonts/`). Bebas Neue pour les titres (majuscules), Poppins 400, 500 et 600 pour le texte. Échelle unique de 5 tailles :

| Classe | Taille (mobile → ordinateur) |
|---|---|
| `.t-h1` | 56 → 128 px |
| `.t-h2` | 44 → 80 px |
| `.t-h3` | 28 → 36 px |
| texte | 17 → 18 px, interlignage 1,6, 65 caractères max |
| `.t-small` | 15 px |

**Matière street** : bordures noires de 2 à 3 px, ombres dures décalées sans flou, coins de 4 px, stickers inclinés de 2 à 4° (`.sticker`), ruban adhésif (`.taped`), coche citron (`.checklist`).

**Mouvement** : un seul langage (courbe `expo.out`, 0,6 à 1,2 s), hero vidéo en WebGL, cartes 3D, boutons magnétiques, bandeau défilant, rideau citron entre les pages. Détails et règles dans la section 11.

**Ton** : direct et chaleureux, phrases courtes, vouvoiement, **pas de tiret long (—)**.

---

## 7. Pages et sections

| Page | Sections (dans l'ordre) |
|---|---|
| **Accueil** | Hero · Bandeau défilant · Services (9 cartes, 3 mises en avant) · Comment ça marche (cascade) · Pourquoi GJS (4 points) · Arcade (3 jeux) · FAQ · CTA final (noir) |
| **Services** | Intro + index typographique · Le tour des 9 services (carrousel 3D) · 9 fiches détaillées (fenêtres ouvertes au clic, adresse `services.html#site`…) · Notre méthode de travail (cascade) · Votre devis gratuit (formulaire court) · CTA (noir) |
| **À propos** | Intro G · J · S (portraits en stickers, les lettres se rassemblent en GJS au scroll) · Notre histoire · Vision (citation qui se corrige, question mise en avant, boucle GJS en 4 temps) · L'équipe (3 associés) · Valeurs (4 cartes qui se retournent : survol, toucher, clavier) · Trajectoire (frise qui se remplit, dates d'exemple à remplacer) · CTA (noir) |
| **Contact** | Formulaire en 3 étapes + WhatsApp, rendez-vous, email et téléphone · Après l'envoi (3 temps : réponse sous 24 h ouvrées, échange en visio sans engagement, plan d'action clair) |
| **Légal, 404** | Mentions légales, Confidentialité, Cookies (traceurs du site, choix en cours et effacement des données du navigateur), Exercer vos droits (email de demande préparé, droits un par un) · 404 |
| **Header (toutes les pages)** | Logo · navigation (ordinateur) · Devis gratuit (toujours visible) · bouton « Menu » : menu plein écran avec les liens numérotés en grand (Accueil, Services, À propos, Arcade, Contact), l'aperçu de la page au survol (`assets/img/menu/`, ordinateur), et en bas les coordonnées, les réseaux et les pages légales |
| **Footer (toutes les pages)** | Le site · Nous joindre · Nous suivre (icônes Instagram, LinkedIn, TikTok) · Légal & RGPD (Mentions légales, Confidentialité, Cookies, Exercer vos droits, Gérer les cookies) |

**Activer la section « Réalisations »** (accueil, masquée par défaut) : dans `index.html`, retirez l'attribut `hidden` de `<section id="realisations">`, puis remplacez les 3 cartes par vos projets réels (`assets/img/realisation-exemple.webp` est une image d'attente).

**Pré-remplissage du contact** : `contact.html?besoins=site,seo&budget=mensuel&delai=urgent#formulaire`. Les boutons « Je veux ça » de l'accueil s'en servent ; ceux des fiches de la page Services cochent le service dans le formulaire de la page.

**Fiches des services** : chaque fiche est une fenêtre (`<dialog>`) qui s'ouvre depuis l'index, le carrousel ou un lien `services.html#seo` venu d'une autre page. Échap, le bouton ×, un clic à côté ou le bouton retour du téléphone la ferment. Sans JavaScript, la fiche s'affiche dans la page à son ancre.

---

## 8. Arborescence

```
index.html  services.html  a-propos.html  contact.html
mentions-legales.html  politique-confidentialite.html  politique-cookies.html  exercer-vos-droits.html  404.html
favicon.svg  site.webmanifest  robots.txt  sitemap.xml  serve.json  package.json  .vercelignore
scripts/sync-services.mjs          synchronise services.js → HTML (cartes, bandeaux, détails)
scripts/vendor/                    recette du paquet Three.js du hero (non déployé)
scripts/posters/                   générateur des 9 affiches de services (non déployé)
scripts/hero-video/                vidéo du hero créée en code : scène Three.js, rendu image par image, assemblage ffmpeg (non déployé)
assets/css/  tokens.css · base.css · layout.css · components.css · motion.css
             pages/ home · services · about · contact · legal · error
assets/js/   main.js · config.js · services.js
             core/  profile · scroll (Lenis) · motion · spring · tilt · magnetic
                    marquee · header · transition · pause · menu (plein écran) · cookies · loader (première visite)
                    hydrate · forms · utils
             hero/  hero.js (scroll, repli DOM) · webgl.js (shaders)
             sections/ steps · faq · stickers (footer) · services-index · carousel
             sections/ borne (Arcade) · games/ arcade (coque) + 3 jeux, chargés au lancement d'une partie
             pages/ contact (formulaire en 3 étapes) · services (fiches et formulaire court) · about (intro GJS, vision, valeurs, frise)
                    legal (email « Exercer vos droits », données du navigateur sur la page Cookies)
             core/forms.js : validation, anti-spam et envoi communs aux deux formulaires
assets/vendor/ gsap (gsap, ScrollTrigger, SplitText) · lenis · three · matter, avec leurs licences
assets/video/  gjs-metal.mp4 · gjs-metal.webm · gjs-metal-mobile.mp4 · gjs-metal-mobile.webm
               gjs-metal-poster.jpg · gjs-metal-poster-mobile.jpg (générés par scripts/hero-video)
assets/img/  icons.svg (19 pictogrammes dont Instagram, LinkedIn, TikTok + 6 décors street) · og-image.jpg · icons/ · equipe/
             services/ 9 affiches des services (générées par scripts/posters)
             menu/ 5 aperçus de pages pour le menu plein écran (640 x 800)
assets/fonts/ Bebas Neue + Poppins (woff2, OFL)
```

---

## 9. RGPD, cookies et accessibilité

- **Bandeau cookies** (textes, catégories, boutons et fonctionnement du site de Gabin) : « Rien sans votre accord. », « Tout refuser » et « Tout accepter » côte à côte, même style, « Personnaliser » juste en dessous (Indispensables, Mesure d’audience, Marketing), dans cet ordre aussi au clavier. Le bandeau s'efface pendant que le menu plein écran est ouvert, puis revient. Il est placé juste après « Aller au contenu » (le clavier l'atteint en deuxième) et, tant qu'il est affiché, la page garde de la place en bas pour que le focus ne passe jamais dessous (il change de côté si besoin). Ouvert par « Gérer les cookies » ou préférences dépliées, il garde le focus jusqu'au choix (Échap le ferme). Aucun script de mesure avant consentement. Choix conservé 6 mois (182 jours), puis effacé et redemandé ; redemandé aussi si `CONSENT_VERSION` change. Lien « Gérer les cookies » dans le footer et sur les pages Confidentialité et Cookies. Stockages actifs par défaut, tous indispensables et sans donnée personnelle : `gjs-consent` (vos choix, 6 mois), `gjs-visited` (écran de chargement déjà vu), `gjs-curtain` (stockage de session, transition entre les pages), records et son des mini-jeux (`gjs-arcade-*`). Détail sur `politique-cookies.html`.
- **Écran de chargement** (première visite seulement, `core/loader.js` + `components.css`) : le sticker GJS se colle, le tampon « Bienvenue ! » s'écrase, le compteur monte à 100 ; tout est en CSS, compteur compris (une colonne de chiffres qui défile en transform, sans coût pour la page) : l'écran compte dès le premier affichage et se lève à 1,8 s au plus, même si la page ou le réseau traîne (si le JavaScript arrive après 3 s, la visite est quand même notée). Bouton « Passer » actif dès l'affichage, annonces aux lecteurs d'écran, quasi instantané en mouvement réduit. Le bandeau cookies et une fiche service ouverte par l'adresse (`services.html#seo`) attendent la fin de l'écran. Aux visites suivantes (`gjs-visited`), seul le rideau entre les pages reste. Pour le revoir : effacez les données du site (bouton sur la page Cookies).
- **Aucun transfert vers des tiers au chargement** : polices, librairies d'animation (`assets/vendor/`) et vidéo sont servies par votre hébergeur. Aucun CDN.
- **Accessibilité** : lien d'évitement, navigation clavier complète, menu plein écran (bouton « Menu ») avec focus piégé, Échap et `aria-expanded`, régions `aria-live`, erreurs de formulaire annoncées et reliées aux champs, cibles tactiles de 48 px, bouton « Mettre en pause » qui arrête vidéo, bandeaux et effets (WCAG 2.2.2), `prefers-reduced-motion` respecté (voir section 11), site lisible sans JavaScript (le formulaire part alors en `mailto:`).

---

## 10. Recette (mesures du 20 octobre 2026, en local, avec toutes les animations)

| Contrôle | Résultat |
|---|---|
| Lighthouse mobile | Accueil **94 à 98** / 100 / 100 / 100 (LCP 2,0 à 2,3 s, CLS ≤ 0,01) ; Services 98, À propos 99, Contact 99, pages légales 99 |
| Lighthouse ordinateur | **100 / 100 / 100 / 100** sur les 6 pages mesurées (LCP ≤ 0,6 s, TBT 0 ms) |
| axe-core WCAG 2.2 AA + bonnes pratiques | **0 violation** sur les 7 pages à 390 et 1440 px, avec et sans animations, bandeau cookies affiché, erreurs de formulaire. Menu plein écran ouvert : 0 violation |
| Clavier | Tab parcourt toutes les cartes et tous les liens (rien n'est sauté en attendant son animation) ; retournement des cartes au clavier, Échap pour revenir |
| Erreurs console | 0 (hors réponse 404 attendue de la page 404) |
| Débordement horizontal à 320, 360, 375, 390, 768, 1024, 1440 px | Aucun ; titre du hero jamais sous le bouton pause, le header ou l'étiquette ; décors jamais sur un texte (vérifié de 1280 à 1920 px) |
| Mouvement réduit | Ni épinglage, ni Lenis, ni WebGL, ni 3D ; vidéo en pause sur le poster et non téléchargée |
| Rideau entre les pages | Levé en CSS 0,04 s après le premier affichage : jamais bloqué par le JavaScript, même en 4G lente |
| Parcours testés | Cookies ; menu plein écran (ouverture, aperçu au survol, focus piégé, Échap) ; « Je veux ça » → service pré-coché ; 3 étapes du formulaire ; envoi simulé → écran de succès ; fiches des services (index, carrousel, adresse, Échap, retour) ; formulaire court de la page Services ; rendu sans JS ; retour arrière (WebGL recréé) ; rechargement (position conservée) ; lecture automatique refusée (pas de carte noire) |

Refaites une mesure Lighthouse sur l'hébergement final, avec les vraies photos.

---

## 11. Animations

### Trois profils, choisis avant le premier affichage

Un petit script dans le `<head>` de chaque page pose `<html data-motion="…">` :

| Profil | Quand | Ce qui tourne |
|---|---|---|
| `desktop` | écran ≥ 1024 px, souris | tout : défilement doux (Lenis), hero WebGL épinglé, scènes collantes, cartes 3D, boutons magnétiques, physique du footer, parallaxe |
| `mobile` | le reste | hero en DOM (sans WebGL ni épinglage), bandeaux, retournement des cartes au toucher, apparitions au scroll |
| `reduced` | `prefers-reduced-motion: reduce` | simples fondus, vidéo en pause sur son poster, aucun épinglage, aucune 3D, aucun effet lié au scroll |

Sans JavaScript (ou si les librairies ne répondent pas en 3 s), tout le contenu s'affiche normalement.

### Animer un nouvel élément : un attribut suffit

```html
<h2 class="t-h2" data-anim="lines">Titre révélé ligne par ligne</h2>
<p data-anim="fade" data-anim-delay="0.2">Bloc qui monte en fondu</p>
<ul data-anim="cascade">…les enfants arrivent l'un après l'autre…</ul>
<span class="sticker" data-anim="stick">Se colle comme un sticker</span>
<span class="sticker" data-anim="stamp">Effet tampon</span>
```

Autres types : `chars` (lettres en vague), `marker` (trait citron qui se dessine sous un `.hl`), `photo` (photo révélée par un masque avec un léger zoom arrière) et `svc-grid` (grille des services). Options du tampon : `data-stamp-from="2.2"` (échelle de départ), `data-stamp-spin="5"` (rotation de départ), `data-shake=".wrap"` (bloc qui encaisse la secousse). Dans un titre `lines` ou `chars`, `<span data-count="40">40</span>` défile de 0 à 40 (la vraie valeur reste dans le HTML) et chaque `.hl` dessine son trait après le titre.

Partout : `data-skew` sur un grand titre le fait s'incliner et s'étirer selon la vitesse du scroll ; `data-parallax="0.12 | 0.25 | 0.45"` sur un décor (`<svg class="deco deco--star">…#d-star`, voir `index.html`) le fait glisser à sa profondeur et réagir un peu à la souris. Les décors sont placés dans les marges, sous le contenu, et masqués sous 1024 px. Le langage est unique : courbe `expo.out`, 0,6 à 1,2 s, décalages de 0,06 à 0,1 s, ressorts physiques pour ce qui suit la souris (`assets/js/core/spring.js`). Les effets ne touchent que `transform` et `opacity`.

### Cartes services, boutons, bandeaux

- **Cartes** : `data-tilt="12"` (inclinaison maxi en degrés) et `data-depth="30"` sur les éléments qui « sortent » de la carte. Les 3 cartes phares (`data-flip`) se retournent : survol sur ordinateur, toucher sur mobile, bouton « Ce qui est inclus » au clavier (Échap pour revenir). Le balisage est généré par `npm run services` (section 2).
- **Boutons** : tous les `.btn` reçoivent le remplissage et le texte qui roule ; sur ordinateur ils sont aussi magnétiques. Ajoutez `btn--no-roll` pour s'en passer.
- **Bandeaux** (`data-band`) : vitesse et sens suivent le scroll, pause au survol.
- **Zone qui défile elle-même** (liste, tableau, fenêtre) : ajoutez `data-lenis-prevent` pour qu'elle garde la molette native (déjà fait pour le message du formulaire, les cookies, le menu et les tableaux).

### Sections animées (chargées seulement si la page les contient)

| Section | Fichier | Ordinateur | Mobile | Mouvement réduit |
|---|---|---|---|---|
| Comment ça marche (et la méthode de la page Services) | `sections/steps.js` | 4 marches en escalier, le trait marqueur citron les relie en descendant au fil du scroll, chaque étape arrive à son tour | cascade verticale, décalage léger | tout affiché, trait posé |
| FAQ | `sections/faq.js` | ouverture en FLIP (transform), « + » qui pivote en croix, une seule question ouverte | idem | ouverture immédiate |
| Stickers du footer (accueil) | `sections/stickers.js` | physique Matter.js (attraper, lancer), chargée à l'approche du footer | chute avec rebond, un toucher les fait sauter | posés |
| Index des services | `sections/services-index.js` | l'affiche du service suit le curseur | liste simple | liste simple |
| Le tour des 9 services | `sections/carousel.js` | cylindre 3D au fil du scroll, clic ou focus pour amener une carte au centre | glissé horizontal | grille |
| Intro G · J · S (À propos) | `pages/about.js` | hero épinglé : les stickers se décollent, les lettres se rassemblent et GJS grandit | effet lié à la sortie du hero, sans épinglage | composition de départ, immobile |
| Vision, Valeurs, Trajectoire | `pages/about.js` | citation barrée puis soulignée au scroll, boucle GJS en 4 temps ; cartes qui se retournent ; frise qui se remplit | idem (cartes au toucher) | états finaux, faces échangées sur place |

Les stickers du footer sont générés depuis `services.js` (badges et noms courts) par `npm run services`. Pour les ajouter à une autre page, copiez le bloc `<div class="footer__play" data-stickers>` de `index.html`.

### Vidéo du hero

Créée entièrement en code, sans aucune image ni vidéo extérieure : les trois lettres G, J, S en acier brossé (tracées depuis la police Bebas Neue du site), posées sur un sol de béton, dans la fumée et le contre-jour. Noir et blanc, sans son, boucle parfaite de 12 s à 24 images par seconde (caméra, lumières et fumée sont périodiques : l'image 288 serait identique à l'image 0).

| Fichier (`assets/video/`) | Format | Poids |
|---|---|---|
| `gjs-metal.mp4` · `gjs-metal.webm` | 1920 × 1080, H.264 · VP9 | 2,3 Mo · 1,5 Mo |
| `gjs-metal-mobile.mp4` · `gjs-metal-mobile.webm` | 720 × 1280, plan recadré pour les téléphones tenus en portrait (le mot en haut, le titre dessous) | 0,9 Mo · 0,7 Mo |
| `gjs-metal-poster.jpg` · `gjs-metal-poster-mobile.jpg` | première image de chaque version | 64 Ko · 32 Ko |

Pour la régénérer (dossier `scripts/hero-video/`, non déployé ; Node 20+ et ffmpeg avec libx264 et libvpx-vp9) :

```bash
cd scripts/hero-video && npm install && npx playwright install chromium
node glyphs.mjs                                              # 1. contours de G, J, S (glyphs.json, déjà fourni)
node render.mjs --format desktop --w 1920 --h 1080 --spp 16  # 2 et 3. scène (scene.js) rendue image par image dans out/desktop
node render.mjs --format mobile  --w 720  --h 1280 --spp 16  #         version portrait dans out/mobile
bash encode.sh                                               # 4. assemblage dans assets/video/ (ou : bash encode.sh mobile)
```

Le rendu tourne dans Chromium sans écran (WebGL logiciel, aucune carte graphique requise) : environ 50 s par image en 1920 × 1080 et 20 s en 720 × 1280 sur 4 cœurs, soit 4 h et 1 h 30. Il reprend là où il s'était arrêté (videz `out/<format>/` après avoir modifié la scène). Pour essayer un réglage : `node render.mjs --format mobile --frames 0,96 --spp 4 --out preview`.

Le voile sombre garantit la lisibilité du titre crème (contraste ≥ 4,5:1 sur le pixel le plus clair de toute la boucle, mesuré image par image) : ellipse ancrée en bas à gauche sur ordinateur (`VEIL_DESKTOP` dans `assets/js/hero/hero.js`, et `.hero__veil` dans `assets/css/pages/home.css` sans WebGL) ; sous 1024 px, voile calé sur le titre (`.hero__veil`, même fichier). Si vous modifiez la scène, refaites cette mesure.

### Librairies (toutes en local)

GSAP 3.15 + ScrollTrigger + SplitText (licence GSAP « Standard No Charge »), Lenis 1.3 (MIT), un sous-ensemble de Three.js r186 (MIT, chargé uniquement sur ordinateur, à l'arrivée du hero) et Matter.js 0.20 (MIT, chargé uniquement sur ordinateur, à l'approche du footer de l'accueil). Pour reconstruire le paquet Three.js : voir `scripts/vendor/README.md`.
