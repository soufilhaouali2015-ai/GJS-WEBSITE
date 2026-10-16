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

function card(s) {
  const cls = ['svc-card', s.featured ? 'svc-card--featured taped taped--one' : ''].filter(Boolean).join(' ');
  return [
    `<article class="${cls}" aria-labelledby="carte-${s.id}" data-reveal>`,
    s.badge ? `  <span class="sticker sticker--ink svc-card__badge" data-badge="${s.id}">${esc(s.badge)}</span>` : '',
    `  <div class="svc-card__head">${icon(s.icon)}</div>`,
    `  <h3 class="t-h3 svc-card__title" id="carte-${s.id}">${esc(s.name)}</h3>`,
    `  <p class="t-small svc-card__tagline">${esc(s.tagline)}</p>`,
    `  <p>${esc(s.benefit)}</p>`,
    `  ${list(s.includes)}`,
    `  ${priceHtml(s)}`,
    '  <div class="svc-card__actions">',
    `    <a class="btn${s.featured ? '' : ' btn--lime'}" href="${contactHref(s)}">Je veux ça<span class="sr-only"> : ${esc(s.label)}</span></a>`,
    `    <a class="link link-arrow" href="services.html#${s.id}">Voir le détail<span class="sr-only"> : ${esc(s.label)}</span></a>`,
    '  </div>',
    '</article>',
  ].filter(Boolean).join('\n');
}

const blocks = {
  cards: () => [
    '<div class="svc-grid">',
    ...featured.map(card),
    '<p class="svc-grid__label">Et aussi</p>',
    ...others.map(card),
    '</div>',
    `<p class="price-legal">${esc(PRICE_NOTE)}</p>`,
  ].join('\n'),

  /* Flyer du hero : les 3 services phares */
  flyer: () => [
    '<ul class="flyer__list">',
    ...featured.map((s) => `  <li><a href="services.html#${s.id}">${esc(s.short)}</a><span class="flyer__price"><small>dès</small><span data-price="${s.id}">${esc(formatPrice(s))}</span></span></li>`),
    '</ul>',
  ].join('\n'),

  /* Page Services : sommaire cliquable */
  toc: () => [
    '<ul class="toc-chips">',
    ...SERVICES.map((s) => `  <li><a class="chip${s.featured ? ' chip--featured' : ''}" href="#${s.id}">${icon(s.icon)}${esc(s.short)}</a></li>`),
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
    `<article class="${cls}" id="${s.id}" aria-labelledby="titre-${s.id}" data-reveal>`,
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
    '  <div class="price-box">',
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
