/* ==========================================================================
   GJS · AFFICHES DES SERVICES : COMPOSITIONS
   Une mise en page par service (clé = id dans assets/js/services.js).
   Les textes (mot principal, accroche, mention « sur devis », badge) viennent du contexte k :
     k.n      numéro d'affiche (« 01 »)
     k.words  mots du nom court, en capitales (« SITE », « INTERNET »)
     k.tag    accroche
     k.quote  { lines: ['SUR DEVIS', 'GRATUIT'], sub: '' } (aucun prix sur les affiches)
     k.badge  badge en capitales (« BEST-SELLER ») ou ''
     k.svg    pictogramme du service (<svg> en trait, couleur = currentColor)
   Fonds en alternance : citron, noir, crème. Toutes les positions sont en px
   sur une affiche de 640 x 800.
   ========================================================================== */

import {
  paper, tape, halftone, fields, marker, arrow, loop, underline, burst, check,
  word, box, sticker, icon, tile, mark, tagline, text_,
} from './elements.mjs';

const join = (...parts) => parts.flat().filter(Boolean).join('\n');

/** Mot principal sur une ou deux lignes dans un conteneur. */
const stack = (lines, { gap = 10, align = 'flex-start' } = {}) => `<div style="display:flex;flex-direction:column;align-items:${align};gap:${gap}px">${lines.join('')}</div>`;

export const COMPOSITIONS = {
  /* 01 · SITE INTERNET : grande feuille crème scotchée sur fond citron */
  site: (k) => ({
    bg: 'lime',
    html: join(
      halftone({ x: 250, y: 0, w: 390, h: 420, step: 17, rMax: 7.5, color: 'ink', field: fields.corner([1, 0], 1.1) }),
      mark({ x: 36, y: 32, n: k.n, variant: 'ink' }),
      paper({
        x: 30, y: 112, w: 580, h: 414, rot: -2, seed: 11,
        innerStyle: 'padding:4px 0 0',
        inner: stack([
          word(k.words[0], { fit: 500, max: 272 }),
          word(k.words.slice(1).join(' '), { fit: 500, max: 178 }),
        ], { gap: 14, align: 'center' }),
      }),
      tape({ x: 60, y: 92, w: 150, h: 40, rot: -7, seed: 3, color: 'ink' }),
      k.badge && sticker({ x: 612, y: 72, anchor: 'right', lines: [k.badge], variant: 'cream', rot: 4, size: 34, z: 9 }),
      sticker({ x: 612, y: 504, anchor: 'right', lines: k.quote.lines, sub: k.quote.sub, variant: 'ink', rot: -3, size: 62 }),
      tile({ x: 42, y: 618, w: 132, bg: 'cream', rot: -4, inner: icon(k.svg, { size: 94, strokeWidth: 2.3 }) }),
      tagline(k.tag, { x: 206, y: 642, w: 340, size: 27 }),
      marker([
        arrow([548, 770], [612, 740], [596, 628], { seed: 4, head: 24 }),
      ], { width: 7 }),
    ),
  }),

  /* 02 · APPLI MOBILE : fond noir, bande citron déchirée en travers */
  app: (k) => ({
    bg: 'ink',
    html: join(
      halftone({ x: 0, y: 500, w: 640, h: 300, step: 18, rMax: 7, color: 'lime', field: (u, v) => v * 1.05 - 0.1 }),
      mark({ x: 36, y: 32, n: k.n, variant: 'lime', numColor: 'cream' }),
      box(32, 92, word(k.words[0], { fit: 576, max: 276, color: 'cream' })),
      paper({
        x: -30, y: 318, w: 700, h: 200, rot: -3, seed: 21, color: 'lime', rim: 'cream', sides: 'tb', amp: 9, shadow: null,
        innerStyle: 'padding:10px 0 0',
        inner: word(k.words.slice(1).join(' '), { fit: 560, max: 196 }),
      }),
      k.badge && sticker({ x: 612, y: 484, anchor: 'right', lines: [k.badge], variant: 'cream', rot: 3, size: 34, shadow: 'lime', z: 9 }),
      paper({
        x: 40, y: 560, w: 176, h: 196, rot: 4, seed: 23, color: 'cream', rim: 'cream-2', shadow: 'lime', shadowX: 8, shadowY: 8, z: 4,
        inner: icon(k.svg, { size: 128, strokeWidth: 2.2 }),
      }),
      tape({ x: 70, y: 544, w: 116, h: 36, rot: -8, seed: 5, color: 'lime' }),
      tagline(k.tag, { x: 252, y: 572, w: 340, size: 30, color: 'cream' }),
      sticker({ x: 252, y: 664, lines: k.quote.lines, sub: k.quote.sub, variant: 'lime', rot: -3, size: 64, shadow: 'cream' }),
      marker([
        burst(560, 696, 36, 64, { from: -1.2, to: 1.2, count: 4, seed: 6 }),
      ], { color: 'lime', width: 7 }),
    ),
  }),

  /* 03 · NOUVEAUX CLIENTS : fond crème, bande citron, cible entourée */
  acquisition: (k) => ({
    bg: 'cream',
    html: join(
      halftone({ x: 0, y: 520, w: 330, h: 280, step: 15, rMax: 5.5, color: 'ink', field: fields.corner([0, 1], 1.05) }),
      mark({ x: 36, y: 32, n: k.n, variant: 'ink' }),
      k.badge && sticker({ x: 610, y: 30, anchor: 'right', lines: [k.badge], variant: 'lime', rot: 3, size: 34 }),
      box(32, 110, word(k.words[0], { fit: 576, max: 240 })),
      paper({
        x: 18, y: 290, w: 604, h: 196, rot: 2, seed: 31, color: 'lime', rim: 'cream-2', amp: 8,
        innerStyle: 'padding:10px 0 0',
        inner: word(k.words.slice(1).join(' '), { fit: 540, max: 210 }),
      }),
      tape({ x: -14, y: 300, w: 120, h: 36, rot: -38, seed: 9 }),
      tape({ x: 546, y: 444, w: 120, h: 36, rot: -38, seed: 10 }),
      icon(k.svg, { x: 60, y: 540, size: 170, strokeWidth: 2.1, z: 4 }),
      tagline(k.tag, { x: 300, y: 536, w: 310, size: 24 }),
      sticker({ x: 610, y: 646, anchor: 'right', lines: k.quote.lines, sub: k.quote.sub, variant: 'ink', rot: -2, size: 52 }),
      marker([
        loop(146, 640, 118, 112, { seed: 12, start: -2.1 }),
      ], { width: 7 }),
    ),
  }),

  /* 04 · RÉSEAUX SOCIAUX : deux bandes de papier collées l'une sur l'autre */
  social: (k) => ({
    bg: 'ink',
    html: join(
      halftone({ x: 0, y: 540, w: 360, h: 260, step: 17, rMax: 6.5, color: 'lime', field: fields.corner([0, 1], 1.05) }),
      mark({ x: 604, y: 32, n: k.n, variant: 'lime', numColor: 'cream', anchor: 'right' }),
      icon(k.svg, { x: 46, y: 62, size: 136, color: 'lime', strokeWidth: 2.2, rot: -6 }),
      tagline(k.tag, { x: 236, y: 100, w: 330, size: 25, color: 'cream' }),
      paper({
        x: 22, y: 236, w: 572, h: 186, rot: -3, seed: 41, color: 'cream', rim: 'cream-2', shadow: 'lime', shadowX: 8, shadowY: 8, z: 3,
        innerStyle: 'padding:12px 0 0',
        inner: word(k.words[0], { fit: 510, max: 200 }),
      }),
      paper({
        x: 50, y: 420, w: 572, h: 186, rot: 2, seed: 43, color: 'lime', rim: 'cream', shadow: 'cream', shadowX: 8, shadowY: 8, z: 4,
        innerStyle: 'padding:12px 0 0',
        inner: word(k.words.slice(1).join(' '), { fit: 510, max: 200 }),
      }),
      tape({ x: 478, y: 220, w: 130, rot: 8, seed: 11 }),
      tape({ x: 24, y: 584, w: 116, rot: -10, seed: 17 }),
      sticker({ x: 612, y: 664, anchor: 'right', lines: k.quote.lines, sub: k.quote.sub, variant: 'cream', rot: 3, size: 56, shadow: 'lime' }),
      marker([
        burst(114, 130, 92, 120, { from: -0.7, to: 0.8, count: 4, seed: 14 }),
        arrow([60, 760], [150, 770], [236, 716], { seed: 15, head: 24 }),
      ], { color: 'lime', width: 7 }),
    ),
  }),

  /* 05 · AUTOMATISATIONS IA : mot vertical sur bande crème, « IA » géant entouré */
  automatisation: (k) => ({
    bg: 'lime',
    html: join(
      halftone({ x: 330, y: 600, w: 310, h: 200, step: 16, rMax: 6.5, color: 'ink', field: fields.corner([1, 1], 1.05) }),
      paper({
        x: 28, y: 26, w: 176, h: 748, rot: -1.5, seed: 51, color: 'cream', rim: 'cream-2', z: 3,
        innerStyle: 'padding:0 0 0 6px',
        inner: word(k.words[0], { fit: 690, max: 168, vertical: true }),
      }),
      tape({ x: 56, y: 8, w: 120, rot: -5, seed: 12 }),
      tape({ x: 64, y: 752, w: 120, rot: 4, seed: 13 }),
      mark({ x: 604, y: 32, n: k.n, variant: 'ink', anchor: 'right' }),
      box(262, 96, word(k.words.slice(1).join(' '), { fit: 300, max: 400 })),
      icon(k.svg, { x: 250, y: 488, size: 120, strokeWidth: 2.3, rot: -4 }),
      tagline(k.tag, { x: 392, y: 496, w: 220, size: 23 }),
      sticker({ x: 262, y: 652, lines: k.quote.lines, sub: k.quote.sub, variant: 'ink', rot: -3, size: 62 }),
      marker([
        loop(392, 246, 178, 188, { seed: 16, start: -2.5 }),
      ], { width: 8 }),
    ),
  }),

  /* 06 · AGENT IA : fond crème, « IA » en lettres citron détourées, bulle de dialogue */
  'agent-ia': (k) => ({
    bg: 'cream',
    html: join(
      halftone({ x: 330, y: 0, w: 310, h: 300, step: 15, rMax: 5.5, color: 'ink', field: fields.corner([1, 0], 1.05) }),
      mark({ x: 36, y: 32, n: k.n, variant: 'ink' }),
      box(32, 104, word(k.words[0], { fit: 576, max: 270 })),
      box(28, 330, word(k.words.slice(1).join(' '), {
        fit: 290, max: 380, color: 'lime', cls: 'word--outline', style: 'text-shadow:12px 12px 0 var(--ink)',
      })),
      tile({ x: 400, y: 330, w: 176, bg: 'ink', rot: 3, shadow: 'lime', radius: '50%', inner: icon(k.svg, { size: 108, color: 'lime', strokeWidth: 2.2 }) }),
      `<div class="abs bubble" style="left:330px;top:556px;width:282px;z-index:6;transform:rotate(-2deg)">
        <div style="position:relative;background:var(--ink);color:var(--cream);border-radius:22px;padding:20px 22px 22px;font:600 25px/1.22 Poppins">${text_(k.tag)}
          <span style="position:absolute;left:146px;top:-28px;width:54px;height:32px;background:var(--ink);clip-path:polygon(100% 0,72% 100%,0 100%)"></span>
        </div></div>`,
      tape({ x: 300, y: 548, w: 104, h: 34, rot: -24, seed: 19, z: 7 }),
      sticker({ x: 34, y: 640, lines: k.quote.lines, sub: k.quote.sub, variant: 'lime', rot: 3, size: 54 }),
      marker([
        burst(488, 418, 102, 130, { from: -1.0, to: -0.15, count: 3, seed: 18 }),
      ], { width: 7 }),
    ),
  }),

  /* 07 · SEO : lettres collées une à une (crème, citron, crème) sur fond noir */
  seo: (k) => {
    const letters = [...k.words.join('')];
    const slots = [
      { x: 28, y: 108, rot: -4, color: 'cream', rim: 'cream-2', shadow: 'lime' },
      { x: 222, y: 140, rot: 3, color: 'lime', rim: 'cream', shadow: 'cream' },
      { x: 416, y: 100, rot: -2, color: 'cream', rim: 'cream-2', shadow: 'lime' },
    ];
    const n = Math.min(letters.length, 3);
    return {
      bg: 'ink',
      html: join(
        halftone({ x: 300, y: 500, w: 340, h: 300, step: 17, rMax: 6.5, color: 'lime', field: fields.corner([1, 1], 1.05) }),
        mark({ x: 36, y: 32, n: k.n, variant: 'lime', numColor: 'cream' }),
        letters.length <= 3
          ? slots.slice(0, n).map((sl, i) => paper({
            x: sl.x, y: sl.y, w: 196, h: 290, rot: sl.rot, seed: 71 + i * 3, color: sl.color, rim: sl.rim,
            shadow: sl.shadow, shadowX: 7, shadowY: 7, z: 3 + i,
            innerStyle: 'padding:22px 0 0',
            inner: word(letters[i], { fit: 150, max: 290 }),
          }))
          : box(32, 120, word(k.words.join(' '), { fit: 576, max: 300, color: 'cream' })),
        tape({ x: 268, y: 124, w: 110, rot: 6, seed: 14 }),
        icon(k.svg, { x: 44, y: 470, size: 124, color: 'lime', strokeWidth: 2.2 }),
        tagline(k.tag, { x: 196, y: 478, w: 400, size: 26, color: 'cream' }),
        sticker({ x: 610, y: 646, anchor: 'right', lines: k.quote.lines, sub: k.quote.sub, variant: 'lime', rot: -3, size: 60, shadow: 'cream' }),
        marker([
          arrow([48, 760], [150, 720], [250, 640], { seed: 19, head: 26 }),
        ], { color: 'lime', width: 8 }),
      ),
    };
  },

  /* 08 · SEA : « SEA » géant sur un soleil de points, bande crème en bas */
  sea: (k) => ({
    bg: 'lime',
    html: join(
      halftone({ x: 40, y: 40, w: 560, h: 520, step: 18, rMax: 8, color: 'ink', field: fields.disc(0.05), z: 1 }),
      mark({ x: 36, y: 32, n: k.n, variant: 'ink' }),
      box(0, 120, word(k.words.join(' '), { fit: 560, max: 420, style: 'text-shadow:10px 10px 0 var(--cream)' }), 'width:640px;display:flex;justify-content:center;z-index:3'),
      paper({
        x: 24, y: 540, w: 592, h: 232, rot: -1.5, seed: 81, color: 'cream', rim: 'cream-2', z: 4,
        innerStyle: 'align-items:flex-start;justify-content:flex-start;padding:86px 30px 0 30px',
        inner: `<div style="display:flex;gap:22px;align-items:flex-start">
          ${icon(k.svg, { size: 104, strokeWidth: 2.3 })}
          <div><p style="font:600 25px/1.22 Poppins;color:var(--ink);text-wrap:balance">${text_(k.tag)}</p></div></div>`,
      }),
      tape({ x: 40, y: 524, w: 130, rot: -7, seed: 15 }),
      sticker({ x: 610, y: 498, anchor: 'right', lines: k.quote.lines, sub: k.quote.sub, variant: 'ink', rot: 3, size: 54 }),
      marker([
        underline(150, 470, 470, { seed: 20, passes: 2, gap: 15, slope: -4 }),
      ], { width: 9, z: 3 }),
    ),
  }),

  /* 09 · CRM : « CRM » géant surligné au citron, coches au marqueur */
  crm: (k) => ({
    bg: 'cream',
    html: join(
      halftone({ x: 0, y: 0, w: 360, h: 300, step: 15, rMax: 5.5, color: 'ink', field: fields.corner([0, 0], 1.05) }),
      mark({ x: 604, y: 32, n: k.n, variant: 'ink', anchor: 'right' }),
      tile({ x: 44, y: 70, w: 150, bg: 'lime', rot: -4, radius: '50%', inner: icon(k.svg, { size: 92, strokeWidth: 2.3 }) }),
      paper({ x: 0, y: 420, w: 640, h: 128, rot: -2.5, seed: 91, color: 'lime', rim: 'cream-2', sides: 'tb', amp: 8, shadow: null, z: 2 }),
      box(0, 232, word(k.words.join(' '), { fit: 572, max: 420 }), 'width:640px;display:flex;justify-content:center;z-index:3'),
      tagline(k.tag, { x: 40, y: 610, w: 300, size: 25 }),
      sticker({ x: 610, y: 640, anchor: 'right', lines: k.quote.lines, sub: k.quote.sub, variant: 'ink', rot: -3, size: 62 }),
      tape({ x: 470, y: 600, w: 120, rot: 10, seed: 16, z: 9 }),
      marker([
        check(260, 120, 46, { seed: 21 }),
        check(336, 152, 46, { seed: 22 }),
        check(412, 128, 46, { seed: 23 }),
      ], { width: 9 }),
    ),
  }),
};
