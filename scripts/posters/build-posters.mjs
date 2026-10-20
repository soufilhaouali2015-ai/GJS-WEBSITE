#!/usr/bin/env node
/* ==========================================================================
   GJS · GÉNÉRATION DES AFFICHES DES SERVICES
   Lit assets/js/services.js (nom court, accroche, badge, pictogramme),
   compose une affiche par service (compositions.mjs + poster.html), la rend
   dans Chromium (Playwright) en 640 x 800 et l'enregistre en WebP dans
   assets/img/services/poster-{id}.webp.

   Usage :
     node scripts/posters/build-posters.mjs
     node scripts/posters/build-posters.mjs --only=site,seo
     node scripts/posters/build-posters.mjs --sheet=planche.png   (planche 3 x 3)
     node scripts/posters/build-posters.mjs --png=dossier          (PNG pleine taille)
   Options : --quality=78 (qualité WebP), --max-kb=70 (poids maximal visé).

   Seule dépendance : Playwright avec Chromium
     npm i -D playwright && npx playwright install chromium
   (ou variable PLAYWRIGHT_MODULE = chemin d'une installation existante).
   ========================================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SERVICES } from '../../assets/js/services.js';
import { COMPOSITIONS } from './compositions.mjs';
import { esc, W, H } from './elements.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, 'assets/img/services');
const NBSP = ' ';

/* ---- Options ------------------------------------------------------------- */

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const QUALITY = Number(args.quality || 78) / 100;
const MAX_BYTES = Number(args['max-kb'] || 70) * 1024;
const ONLY = args.only ? String(args.only).split(',') : null;

/* ---- Playwright ---------------------------------------------------------- */

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'];
  for (const name of candidates.filter(Boolean)) {
    try { return require(name); } catch { /* candidat suivant */ }
  }
  throw new Error('Playwright est introuvable. Installez-le : npm i -D playwright && npx playwright install chromium');
}

/* ---- Ressources : polices, pictogrammes, gabarit ------------------------- */

async function fontFaces() {
  const faces = [
    ['BebasNeue-Regular.woff2', 'Bebas Neue', 400],
    ['Poppins-Regular.woff2', 'Poppins', 400],
    ['Poppins-Medium.woff2', 'Poppins', 500],
    ['Poppins-SemiBold.woff2', 'Poppins', 600],
  ];
  const css = await Promise.all(faces.map(async ([file, family, weight]) => {
    const b64 = (await readFile(path.join(ROOT, 'assets/fonts', file))).toString('base64');
    return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};font-style:normal;font-display:block}`;
  }));
  return css.join('\n');
}

function iconReader(sprite) {
  return (name) => {
    const m = sprite.match(new RegExp(`<symbol id="i-${name}"([^>]*)>([\\s\\S]*?)</symbol>`));
    if (!m) throw new Error(`Pictogramme #i-${name} absent de assets/img/icons.svg`);
    return `<svg xmlns="http://www.w3.org/2000/svg"${m[1]} aria-hidden="true">${m[2].trim()}</svg>`;
  };
}

/* ---- Textes --------------------------------------------------------------- */

/** Aucun prix sur les affiches : chaque service est sur devis gratuit. */
const QUOTE = { lines: ['SUR DEVIS', 'GRATUIT'], sub: '' };

function context(service, index, svgFor) {
  return {
    n: String(index + 1).padStart(2, '0'),
    words: service.short.toUpperCase().split(/\s+/),
    tag: service.tagline,
    quote: QUOTE,
    badge: service.badge ? esc(service.badge.toUpperCase()) : '',
    svg: svgFor(service.icon),
  };
}

/* ---- Rendu ---------------------------------------------------------------- */

async function encodeWebp(page, png, quality) {
  const b64 = await page.evaluate(async ({ src, q }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) throw new Error('Ce Chromium ne sait pas encoder le WebP');
    return url.slice(url.indexOf(',') + 1);
  }, { src: `data:image/png;base64,${png.toString('base64')}`, q: quality });
  return Buffer.from(b64, 'base64');
}

async function contactSheet(page, items, file) {
  const cell = { w: 320, h: 400 };
  const gap = 28;
  const pad = 36;
  const width = pad * 2 + cell.w * 3 + gap * 2;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#57524A;padding:${pad}px;font:600 14px/1 sans-serif;color:#F4F0E8}
    .grid{display:grid;grid-template-columns:repeat(3,${cell.w}px);gap:${gap}px}
    img{display:block;width:${cell.w}px;height:${cell.h}px}
    p{margin:8px 0 0;letter-spacing:.04em}
  </style><div class="grid">${items.map((it) => `<figure style="margin:0"><img src="data:image/webp;base64,${it.webp.toString('base64')}"><p>${it.id} · ${(it.webp.length / 1024).toFixed(1)} Ko</p></figure>`).join('')}</div>`;
  await page.setViewportSize({ width, height: 800 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: file, fullPage: true });
}

async function main() {
  const { chromium } = loadPlaywright();
  const [template, fonts, sprite] = await Promise.all([
    readFile(path.join(HERE, 'poster.html'), 'utf8'),
    fontFaces(),
    readFile(path.join(ROOT, 'assets/img/icons.svg'), 'utf8'),
  ]);
  const svgFor = iconReader(sprite);
  await mkdir(OUT_DIR, { recursive: true });
  if (args.png) await mkdir(path.resolve(String(args.png)), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const encoder = await browser.newPage();
  const done = [];

  try {
    for (const [index, service] of SERVICES.entries()) {
      if (ONLY && !ONLY.includes(service.id)) continue;
      const compose = COMPOSITIONS[service.id];
      if (!compose) {
        console.warn(`⚠ Pas de composition pour « ${service.id} » : ajoutez-la dans compositions.mjs.`);
        continue;
      }
      const { bg, html: content } = compose(context(service, index, svgFor));
      if (/[\u2013\u2014]/.test(content)) throw new Error(`Tiret long ou demi-cadratin interdit dans l'affiche « ${service.id} ».`);

      const html = template
        .replace('{{FONTS}}', () => fonts)
        .replace('{{BG}}', bg)
        .replace('{{CONTENT}}', () => content);
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__posterReady === true, null, { timeout: 20000 });
      const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
      if (args.png) await writeFile(path.join(path.resolve(String(args.png)), `poster-${service.id}.png`), png);

      let q = QUALITY;
      let webp = await encodeWebp(encoder, png, q);
      while (webp.length > MAX_BYTES && q > 0.5) {
        q = Math.round((q - 0.04) * 100) / 100;
        webp = await encodeWebp(encoder, png, q);
      }
      const out = path.join(OUT_DIR, `poster-${service.id}.webp`);
      await writeFile(out, webp);
      done.push({ id: service.id, webp });
      const warn = webp.length > MAX_BYTES ? '  ⚠ au-dessus du poids visé' : '';
      console.log(`✓ ${path.relative(ROOT, out)}  ${(webp.length / 1024).toFixed(1)} Ko  (qualité ${Math.round(q * 100)})${warn}`);
    }

    if (args.sheet && done.length) {
      const file = path.resolve(String(args.sheet));
      await contactSheet(encoder, done, file);
      console.log(`✓ planche : ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
