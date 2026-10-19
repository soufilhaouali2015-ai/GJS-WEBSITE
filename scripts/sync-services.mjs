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
import { SERVICES, PRICE_NOTE, formatPrice } from '../assets/js/services.js';
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

const priceHtml = (s, { tag = 'p' } = {}) => [
  `<${tag} class="price">`,
  '<span class="price__from">À partir de</span> ',
  `<strong class="price__value" data-price="${s.id}">${esc(formatPrice(s))}</strong> `,
  '<span class="price__tax">HT</span>',
  s.price.note ? `<span class="price__note">${esc(s.price.note)}</span>` : '',
  `</${tag}>`,
].join('');

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
      `      ${priceHtml(s).replace('<p class="price">', '<p class="price" data-depth="48">')}`,
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
    `        ${priceHtml(s).replace('<p class="price">', '<p class="price" data-depth="52">')}`,
    `        <button class="svc-card__flip-btn" type="button" data-flip-toggle aria-expanded="false" aria-controls="verso-${s.id}">Ce qui est inclus<span class="sr-only"> : ${esc(s.label)}</span></button>`,
    '      </div>',
    `      <div class="svc-card__face svc-card__face--back" id="verso-${s.id}">`,
    `        <p class="svc-card__back-title" data-depth="30">Ce qui est inclus<span class="sr-only"> : ${esc(s.label)}</span></p>`,
    `        ${list(s.includes).replace('<ul class="checklist">', '<ul class="checklist" data-depth="22">')}`,
    `        ${priceHtml(s).replace('<p class="price">', '<p class="price" data-depth="44">')}`,
    ...actions('').map((l) => `        ${l}`),
    '      </div>',
    '    </div>',
    '  </div>',
    '</article>',
  ].filter(Boolean).join('\n');
}

/* Double bandeau (décor) : les 9 services, répétés */
const STAR = '<svg class="band__star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>';
const bandGroup = (list) => `<div class="band__group">${list.map((n) => `<span class="band__item">${esc(n)}</span>${STAR}`).join('')}</div>`;

const blocks = {
  cards: () => [
    '<div class="svc-grid" data-anim="svc-grid">',
    ...featured.map(card),
    '<p class="svc-grid__label">Et aussi</p>',
    ...others.map(card),
    '</div>',
    `<p class="price-legal">${esc(PRICE_NOTE)}</p>`,
  ].join('\n'),

  /* Double bandeau entre le hero et les services */
  bands: () => [
    `<div class="band band--lime" data-band data-speed="60" data-dir="-1"><div class="band__track" data-band-track>${bandGroup(SERVICES.map((x) => x.short))}</div></div>`,
    `<div class="band band--ink" data-band data-speed="48" data-dir="1"><div class="band__track" data-band-track>${bandGroup([...SERVICES].reverse().map((x) => x.name))}</div></div>`,
  ].join('\n'),

  /* Footer de l'accueil : stickers qui tombent (décor, aria-hidden sur la zone) */
  stickers: () => {
    const tones = ['', ' sticker--cream', '', ' sticker--ink', ' sticker--cream', '', ' sticker--cream', '', ' sticker--ink'];
    return [
      '<span class="drop drop--logo">GJS</span>',
      ...SERVICES.filter((x) => x.badge).map((x) => `<span class="drop sticker sticker--ink">${esc(x.badge)}</span>`),
      '<span class="drop drop--round"><strong>-40&nbsp;%</strong></span>',
      '<span class="drop sticker sticker--cream drop--wide">Fait en Île-de-France</span>',
      ...SERVICES.map((x, i) => `<span class="drop sticker${tones[i % tones.length]}">${esc(x.short)}</span>`),
    ].join('\n');
  },

  /* Page Services : sommaire cliquable */
  /* Index typographique géant : au survol (ordinateur), l'affiche du service suit le curseur.
     Sur mobile, une liste simple avec les pictogrammes. */
  toc: () => [
    '<ol class="svc-index" data-svc-index>',
    ...SERVICES.map((s, i) => [
      `  <li class="svc-index__item${s.featured ? ' is-featured' : ''}">`,
      `    <a class="svc-index__link" href="#${s.id}" data-poster="assets/img/services/poster-${s.id}.webp">`,
      `      <span class="svc-index__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`,
      `      ${icon(s.icon, 'icon svc-index__icon')}`,
      `      <span class="svc-index__name">${esc(s.short)}</span>`,
      `      <span class="svc-index__price"><span class="sr-only">, </span>dès <span data-price="${s.id}">${esc(formatPrice(s))}</span></span>`,
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
      `      <p class="orbit__price">dès <span data-price="${s.id}">${esc(formatPrice(s))}</span> <small>HT</small></p>`,
      `      <a class="link link-arrow" href="#${s.id}">Voir le détail<span class="sr-only"> : ${esc(s.label)}</span></a>`,
      '    </article>',
      '  </li>',
    ].join('\n')),
    '</ul>',
  ].join('\n'),

  /* Page Services : fiches détaillées */
  featured: () => `<div class="svc-details">\n${featured.map(detail).join('\n')}\n</div>`,
  others: () => `<div class="svc-details svc-details--others">\n${others.map(detail).join('\n')}\n</div>\n<p class="price-legal">${esc(PRICE_NOTE)}</p>`,

  /* Choix des services : configurateur et formulaire de contact */
  'choices-config': () => choices(false),
  'choices-contact': () => choices(true),

  /* Données structurées */
  'jsonld-services': () => `<script type="application/ld+json">${JSON.stringify(servicesGraph())}</script>`,
  'jsonld-catalog': () => `<script type="application/ld+json">${JSON.stringify(catalog())}</script>`,
};

function detail(s) {
  const cls = ['svc-detail', s.featured ? 'svc-detail--featured' : ''].filter(Boolean).join(' ');
  return [
    `<article class="${cls}" id="${s.id}" aria-labelledby="titre-${s.id}" data-anim="fade" data-tilt="4">`,
    s.badge ? `  <span class="sticker svc-detail__badge" data-badge="${s.id}">${esc(s.badge)}</span>` : '',
    '  <div class="svc-detail__head">',
    `    ${icon(s.icon)}`,
    `    <h3 class="t-h3" id="titre-${s.id}">${esc(s.label)}</h3>`,
    `    <p class="svc-detail__tagline">${esc(s.tagline)}</p>`,
    `    <p class="t-intro">${esc(s.benefit)}</p>`,
    '  </div>',
    '  <div class="svc-detail__body">',
    `    <div><h4 class="svc-detail__label">Ce qu’on fait</h4>${list(s.does)}</div>`,
    `    <div><h4 class="svc-detail__label">Ce que vous obtenez</h4>${list(s.gets)}</div>`,
    '  </div>',
    '  <div class="price-box" data-anim="stamp" data-stamp-from="1.3" data-stamp-spin="5">',
    `    ${priceHtml(s)}`,
    `    <p class="price-box__delay"><strong>Délai indicatif</strong>${esc(s.delay)}</p>`,
    `    <a class="btn btn--block" href="${contactHref(s)}">Je veux ça<span class="sr-only"> : ${esc(s.label)}</span></a>`,
    '  </div>',
    '</article>',
  ].filter(Boolean).join('\n');
}

function choices(withUnknown) {
  const items = SERVICES.map((s) => `  <label class="choice"><input type="checkbox" name="besoins" value="${s.id}"><span class="choice__box"><span class="choice__mark" aria-hidden="true"></span>${esc(s.label)}</span></label>`);
  if (withUnknown) items.push('  <label class="choice"><input type="checkbox" name="besoins" value="autre"><span class="choice__box"><span class="choice__mark" aria-hidden="true"></span>Je ne sais pas encore</span></label>');
  return items.join('\n');
}

function priceSpecs(s) {
  const specs = [];
  if (s.price.setup) specs.push({ '@type': 'PriceSpecification', minPrice: s.price.setup, priceCurrency: 'EUR', valueAddedTaxIncluded: false });
  if (s.price.monthly) specs.push({ '@type': 'UnitPriceSpecification', minPrice: s.price.monthly, priceCurrency: 'EUR', unitText: 'mois', valueAddedTaxIncluded: false });
  return specs;
}

function offer(s) {
  return {
    '@type': 'Offer',
    priceCurrency: 'EUR',
    price: s.price.setup || s.price.monthly,
    priceSpecification: priceSpecs(s),
    url: `${SITE}/${contactHref(s)}`,
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
