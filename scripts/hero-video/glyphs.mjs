/* ==========================================================================
   GJS · VIDÉO DU HERO · ÉTAPE 1 : CONTOURS DES LETTRES
   Lit la police du site (Bebas Neue, WOFF2), en extrait les contours exacts
   de G, J et S (courbes de Bézier) et les écrit dans glyphs.json, à l'échelle
   « hauteur de capitale = 1 ». La scène 3D les extrude ensuite.
   Usage : node glyphs.mjs
   ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import opentype from 'opentype.js';
import wawoff from 'wawoff2';

const here = dirname(fileURLToPath(import.meta.url));
const fontPath = join(here, '../../assets/fonts/BebasNeue-Regular.woff2');

const ttf = await wawoff.decompress(readFileSync(fontPath));
const buf = Buffer.from(ttf);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const capHeight = font.tables.os2.sCapHeight || font.charToGlyph('H').getBoundingBox().y2;
const scale = 1 / capHeight;
const TRACKING = 0.06; // espace entre les lettres, en hauteur de capitale

const letters = [];
let pen = 0;
for (const ch of 'GJS') {
  const glyph = font.charToGlyph(ch);
  const box = glyph.getBoundingBox();
  // Commandes en unités de police, origine à gauche de l'encre et sur la ligne de base
  const commands = glyph.getPath(0, 0, font.unitsPerEm).commands.map((c) => {
    const out = { type: c.type };
    ['x', 'y', 'x1', 'y1', 'x2', 'y2'].forEach((k) => {
      if (c[k] === undefined) return;
      const v = k.startsWith('x') ? (c[k] - box.x1) * scale : -c[k] * scale; // y vers le haut
      out[k] = Math.round(v * 1e5) / 1e5;
    });
    return out;
  });
  const width = (box.x2 - box.x1) * scale;
  letters.push({ char: ch, x: Math.round(pen * 1e5) / 1e5, width: Math.round(width * 1e5) / 1e5, commands });
  pen += width + TRACKING;
}

const total = pen - TRACKING;
writeFileSync(join(here, 'glyphs.json'), JSON.stringify({ capHeight: 1, width: total, letters }, null, 1));
console.log(`glyphs.json : ${letters.map((l) => `${l.char} ${l.width.toFixed(3)}`).join(', ')} (largeur ${total.toFixed(3)})`);
