#!/usr/bin/env node
/* ==========================================================================
   GJS · SYNCHRONISATION DES SERVICES
   Lit assets/js/services.js (source unique) et réécrit, dans les pages HTML,
   tout ce qui se trouve entre les marqueurs :
       <!-- @services:NOM -->  …contenu généré…  <!-- /@services:NOM -->

   Usage :  npm run services     (ou : node scripts/sync-services.mjs)
   Aucune dépendance. Node 18 ou plus.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SERVICES } from '../assets/js/services.js';
import { CONFIG } from '../assets/js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = CONFIG.SITE_URL;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="assets/img/icons.svg#i-${name}"></use></svg>`;
const featured = SERVICES.filter((s) => s.featured);
const others = SERVICES.filter((s) => !s.featured);
const contactHref = (s) => `contact.html?besoins=${s.id}#formulaire`;

/* Plus aucun prix affiché : chaque projet est chiffré sur devis gratuit */
const quoteHtml = (depth) => `<p class="svc-card__quote" data-depth="${depth}">Sur devis gratuit</p>`;

const list = (items, cls = 'checklist') => `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

/* ---- Accueil : grille de cartes courtes --------------------------------- */

/* Carte courte de l'accueil.
   - toutes : inclinaison 3D (data-tilt), couches en relief (data-depth), ombre dure séparée ;
   - phares : recto allégé + verso « ce qui est inclus » (data-flip).
   Sans JavaScript ou en mouvement réduit, le verso s'affiche simplement sous le recto. */
function card(s) {
  const title = `<h3 class="t-h3 svc-card__title" id="carte-${s.id}" data-depth="30">${esc(s.name)}</h3>`;
  const head = `<div class="svc-card__head" data-depth="44">${icon(s.icon)}</div>`;
  const actions = (btnClass) => [
    `<div class="svc-card__actions" data-depth="26">`,
    `  <a class="btn${btnClass}" href="${contactHref(s)}">Je veux ça<span class="sr-only"> : ${esc(s.label)}</span></a>`,
    `  <a class="link link-arrow" href="services.html#${s.id}">Voir le détail<span class="sr-only"> : ${esc(s.label)}</span></a>`,
    '</div>',
  ];
  if (!s.featured) {
    return [
      `<article class="svc-card" aria-labelledby="carte-${s.id}" data-tilt="12">`,
      '  <span class="svc-card__shadow" aria-hidden="true"></span>',
      '  <div class="svc-card__body" data-tilt-body>',
      '    <div class="svc-card__face">',
      `      ${head}`,
      `      ${title}`,
      `      <p class="t-small svc-card__tagline">${esc(s.tagline)}</p>`,
      `      <p>${esc(s.benefit)}</p>`,
      `      ${list(s.includes)}`,
      `      ${quoteHtml(48)}`,
      ...actions(' btn--lime').map((l) => `      ${l}`),
      '    </div>',
      '  </div>',
      '</article>',
    ].join('\n');
  }
  return [
    `<article class="svc-card svc-card--featured" aria-labelledby="carte-${s.id}" data-tilt="12" data-flip>`,
    '  <span class="svc-card__shadow" aria-hidden="true"></span>',
    '  <div class="svc-card__body" data-tilt-body>',
    '    <div class="svc-card__inner" data-flip-inner>',
    '      <div class="svc-card__face svc-card__face--front">',
    s.badge ? `        <span class="sticker sticker--ink svc-card__badge" data-badge="${s.id}" data-depth="70">${esc(s.badge)}</span>` : '',
    `        ${head}`,
    `        ${title}`,
    `        <p class="t-small svc-card__tagline">${esc(s.tagline)}</p>`,
    `        <p class="svc-card__benefit">${esc(s.benefit)}</p>`,
    `        ${quoteHtml(52)}`,
    `        <button class="svc-card__flip-btn" type="button" data-flip-toggle aria-expanded="false" aria-controls="verso-${s.id}">Ce qui est inclus<span class="sr-only"> : ${esc(s.label)}</span></button>`,
    '      </div>',
    `      <div class="svc-card__face svc-card__face--back" id="verso-${s.id}">`,
    `        <p class="svc-card__back-title" data-depth="30">Ce qui est inclus<span class="sr-only"> : ${esc(s.label)}</span></p>`,
    `        ${list(s.includes).replace('<ul class="checklist">', '<ul class="checklist" data-depth="22">')}`,
    ...actions('').map((l) => `        ${l}`),
    '      </div>',
    '    </div>',
    '  </div>',
    '</article>',
  ].filter(Boolean).join('\n');
}

/* Bandeau défilant : les 9 services en grand (rangée lisible), puis en contour
   avec les mots qui nous définissent (rangée décorative, masquée aux lecteurs d'écran) */
const MARQUEE_WORDS = ['sur-mesure', 'mesuré', 'rentable', 'rapide', 'utile', 'vivant'];
const DOT = '<span class="marquee__dot" aria-hidden="true"></span>';
const marqueeRow = (attrs, items) => `<div class="marquee${attrs.cls || ''}" data-marquee data-speed="${attrs.speed}" data-direction="${attrs.dir}"${attrs.hidden ? ' aria-hidden="true"' : ''}><div class="marquee__track"><div class="marquee__group">${items}</div></div></div>`;

const blocks = {
  cards: () => [
    '<div class="svc-grid" data-anim="svc-grid">',
    ...featured.map(card),
    '<p class="svc-grid__label">Et aussi</p>',
    ...others.map(card),
    '</div>',
  ].join('\n'),

  /* Bandeau défilant entre le hero et les services */
  bands: () => [
    marqueeRow({ speed: 70, dir: -1 }, SERVICES.map((x) => `<span class="marquee__item">${esc(x.short)}</span>${DOT}`).join('')),
    marqueeRow({ cls: ' marquee--reverse', speed: 55, dir: 1, hidden: true }, SERVICES.map((x, i) => `<span class="marquee__item marquee__item--outline">${esc(x.short)}</span><span class="marquee__item marquee__item--accent">${esc(MARQUEE_WORDS[i % MARQUEE_WORDS.length])}</span>`).join('')),
  ].join('\n'),

  /* Footer de l'accueil : stickers qui tombent (décor, aria-hidden sur la zone) */
  stickers: () => {
    const tones = ['', ' sticker--cream', '', ' sticker--ink', ' sticker--cream', '', ' sticker--cream', '', ' sticker--ink'];
    return [
      '<span class="drop drop--logo">GJS</span>',
      ...SERVICES.filter((x) => x.badge).map((x) => `<span class="drop sticker sticker--ink">${esc(x.badge)}</span>`),
      '<span class="drop sticker sticker--cream drop--wide">Fait en Île-de-France</span>',
      ...SERVICES.map((x, i) => `<span class="drop sticker${tones[i % tones.length]}">${esc(x.short)}</span>`),
    ].join('\n');
  },

  /* Page Services : index typographique géant. Au survol (ordinateur), l'affiche du
     service suit le curseur ; un clic ouvre sa fiche détaillée. Sur mobile, une
     liste simple avec les pictogrammes. */
  toc: () => [
    '<ol class="svc-index" data-svc-index>',
    ...SERVICES.map((s, i) => [
      `  <li class="svc-index__item${s.featured ? ' is-featured' : ''}">`,
      `    <a class="svc-index__link" href="#${s.id}" data-poster="assets/img/services/poster-${s.id}.webp">`,
      `      <span class="svc-index__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`,
      `      ${icon(s.icon, 'icon svc-index__icon')}`,
      `      <span class="svc-index__name">${esc(s.short)}</span>`,
      '    </a>',
      '  </li>',
    ].join('\n')),
    '</ol>',
  ].join('\n'),

  /* Carrousel en cylindre : les 9 services tournent au fil du scroll (ordinateur),
     glissé horizontal sur mobile, simple grille en mouvement réduit et sans JS. */
  orbit: () => [
    '<ul class="orbit__ring" data-orbit-ring>',
    ...SERVICES.map((s, i) => [
      `  <li class="orbit__card${s.featured ? ' is-featured' : ''}" data-orbit-card="${i}">`,
      `    <article class="orbit__face" aria-labelledby="orbite-${s.id}">`,
      `      ${icon(s.icon)}`,
      `      <h3 class="t-h3" id="orbite-${s.id}">${esc(s.short)}</h3>`,
      `      <p class="orbit__tagline">${esc(s.tagline)}</p>`,
      `      <p class="orbit__quote">Sur devis gratuit</p>`,
      `      <a class="link link-arrow" href="#${s.id}">Voir le détail<span class="sr-only"> : ${esc(s.label)}</span></a>`,
      '    </article>',
      '  </li>',
    ].join('\n')),
    '</ul>',
  ].join('\n'),

  /* Page Services : une fiche détaillée par service, ouverte depuis le tour */
  sheets: () => SERVICES.map(sheet).join('\n'),

  /* Choix des services : formulaire de la page Services et formulaire de contact */
  'choices-quick': () => choices(false, 'qf-'),
  'choices-contact': () => choices(true),

  /* Données structurées */
  'jsonld-services': () => `<script type="application/ld+json">${JSON.stringify(servicesGraph())}</script>`,
  'jsonld-catalog': () => `<script type="application/ld+json">${JSON.stringify(catalog())}</script>`,
};

/* Fiche détaillée (fenêtre ouverte au clic sur un service du tour) : tout ce qui
   est utile pour décider, sans aucun prix. Sans JavaScript, la fiche s'affiche
   dans la page quand on suit son lien (#site, #app…). */
function sheet(s, i) {
  return [
    `<dialog class="svc-sheet" id="${s.id}" aria-labelledby="fiche-${s.id}" data-sheet data-lenis-prevent>`,
    '  <div class="svc-sheet__card">',
    '    <div class="svc-sheet__bar">',
    `      <p class="svc-sheet__crumb" aria-hidden="true"><span class="svc-sheet__num">N°${String(i + 1).padStart(2, '0')}</span>${esc(s.short)}</p>`,
    `      <button class="svc-sheet__close" type="button" data-sheet-close><span aria-hidden="true">×</span><span class="sr-only">Fermer la fiche ${esc(s.label)}</span></button>`,
    '    </div>',
    '    <div class="svc-sheet__main">',
    `      <div class="svc-sheet__visual"><img src="assets/img/services/poster-${s.id}.webp" width="640" height="800" alt="" loading="lazy" decoding="async"></div>`,
    '      <div class="svc-sheet__body">',
    `        <p class="svc-sheet__kicker">${icon(s.icon)}${s.badge ? `<span class="sticker" data-badge="${s.id}">${esc(s.badge)}</span>` : ''}</p>`,
    `        <h2 class="t-h2 svc-sheet__title" id="fiche-${s.id}">${esc(s.label)}</h2>`,
    `        <p class="svc-sheet__tagline">${esc(s.tagline)}</p>`,
    `        <p class="t-intro">${esc(s.benefit)}</p>`,
    '        <div class="svc-sheet__cols">',
    `          <div><h3 class="svc-sheet__label">Ce qui est inclus</h3>${list(s.includes)}</div>`,
    `          <div><h3 class="svc-sheet__label">Ce qu’on fait</h3>${list(s.does)}</div>`,
    `          <div><h3 class="svc-sheet__label">Ce que vous obtenez</h3>${list(s.gets)}</div>`,
    '        </div>',
    '        <div class="svc-sheet__foot">',
    `          <p class="svc-sheet__delay"><strong>Délai indicatif</strong>${esc(s.delay)}</p>`,
    '          <p class="svc-sheet__quote">Sur devis gratuit</p>',
    `          <a class="btn btn--lime" href="#demande" data-pick="${s.id}">Je veux ça<span class="sr-only"> : ${esc(s.label)}</span></a>`,
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</dialog>',
  ].join('\n');
}

function choices(withUnknown, idPrefix = '') {
  const described = idPrefix ? ` aria-describedby="${idPrefix}besoins-error"` : '';
  const items = SERVICES.map((s) => `  <label class="choice"><input type="checkbox" name="besoins" value="${s.id}"${described}><span class="choice__box"><span class="choice__mark" aria-hidden="true"></span>${esc(s.label)}</span></label>`);
  if (withUnknown) items.push('  <label class="choice"><input type="checkbox" name="besoins" value="autre"><span class="choice__box"><span class="choice__mark" aria-hidden="true"></span>Je ne sais pas encore</span></label>');
  return items.join('\n');
}

// Aucune donnée de prix : chaque service est proposé sur devis gratuit
function offer(s) {
  return {
    '@type': 'Offer',
    url: `${SITE}/${contactHref(s)}`,
    description: 'Sur devis gratuit, après un premier échange.',
  };
}

function servicesGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': SERVICES.map((s) => ({
      '@type': 'Service',
      '@id': `${SITE}/services.html#${s.id}`,
      name: s.label,
      serviceType: s.label,
      description: `${s.benefit} ${s.includes.join('. ')}.`,
      provider: { '@id': `${SITE}/#organization` },
      areaServed: [{ '@type': 'AdministrativeArea', name: 'Île-de-France' }, { '@type': 'Country', name: 'France' }],
      url: `${SITE}/services.html#${s.id}`,
      offers: offer(s),
    })),
  };
}

function catalog() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    '@id': `${SITE}/#catalogue`,
    name: 'Services de l’agence GJS',
    itemListElement: SERVICES.map((s) => ({
      ...offer(s),
      itemOffered: { '@type': 'Service', '@id': `${SITE}/services.html#${s.id}`, name: s.label, url: `${SITE}/services.html#${s.id}` },
    })),
  };
}

/* ---- Remplacement entre marqueurs, en conservant l'indentation ---------- */

const FILES = ['index.html', 'services.html', 'contact.html'];
const MARKER = /([ \t]*)<!-- @services:([\w-]+) -->[\s\S]*?<!-- \/@services:\2 -->/g;

let total = 0;
for (const file of FILES) {
  const full = path.join(ROOT, file);
  let html;
  try { html = await readFile(full, 'utf8'); } catch { continue; }
  let count = 0;
  const next = html.replace(MARKER, (match, indent, name) => {
    const build = blocks[name];
    if (!build) { console.warn(`  ⚠ ${file} : bloc inconnu « ${name} »`); return match; }
    count += 1;
    const body = build().split('\n').map((l) => (l ? indent + l : l)).join('\n');
    return `${indent}<!-- @services:${name} -->\n${body}\n${indent}<!-- /@services:${name} -->`;
  });
  if (next !== html) await writeFile(full, next);
  total += count;
  console.log(`✓ ${file} : ${count} bloc(s) synchronisé(s)`);
}
console.log(`Terminé : ${total} bloc(s), ${SERVICES.length} services.`);
