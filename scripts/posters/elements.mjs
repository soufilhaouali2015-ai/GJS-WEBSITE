/* ==========================================================================
   GJS · AFFICHES DES SERVICES : BRIQUES GRAPHIQUES
   Papier déchiré, ruban adhésif, trame de points, coups de marqueur, stickers.
   Chaque fonction renvoie du HTML (ou un tracé SVG) positionné en pixels sur
   l'affiche de 640 x 800. Tout est déterministe (graine fixe) : relancer le
   script redonne exactement les mêmes affiches.
   ========================================================================== */

export const W = 640;
export const H = 800;

/* ---- Hasard reproductible ------------------------------------------------ */

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n) => Math.round(n * 10) / 10;
const px = (n) => `${r1(n)}px`;

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Couleur de la palette : 'cream' | 'cream-2' | 'ink' | 'lime' | 'grey'. */
const c = (name) => `var(--${name})`;

/* ---- Papier déchiré ------------------------------------------------------ */

/**
 * Polygone « déchiré » inscrit dans un rectangle w x h.
 * sides : côtés déchirés parmi t, r, b, l (les autres restent droits).
 * inset : retrait supplémentaire des côtés déchirés (pour laisser voir la tranche).
 */
export function tornPolygon(w, h, { seed = 1, sides = 'trbl', amp = 7, step = [5, 13], inset = 0, bite = 0.07 } = {}) {
  const R = rng(seed);
  const pts = [];
  const edge = (side, x0, y0, x1, y1, nx, ny) => {
    const torn = sides.includes(side);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    let t = 0;
    while (t < len) {
      let d = 0;
      if (torn) {
        d = inset + R() * amp;
        if (R() < bite) d += amp * (0.8 + R());
      }
      pts.push([x0 + ux * t + nx * d, y0 + uy * t + ny * d]);
      t += torn ? step[0] + R() * (step[1] - step[0]) : len;
    }
  };
  edge('t', 0, 0, w, 0, 0, 1);
  edge('r', w, 0, w, h, -1, 0);
  edge('b', w, h, 0, h, 0, -1);
  edge('l', 0, h, 0, 0, 1, 0);
  return `polygon(${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(',')})`;
}

/**
 * Morceau de papier collé : une tranche (rim) visible le long des déchirures,
 * une face colorée, une ombre dure décalée, et un contenu (centré par défaut).
 */
export function paper({
  x, y, w, h, rot = 0, color = 'cream', rim = 'cream-2', seed = 1, sides = 'trbl', amp = 7,
  shadow = 'ink', shadowX = 9, shadowY = 9, z = 2, inner = '', innerStyle = '', cls = '',
}) {
  const filter = shadow ? `filter:drop-shadow(${shadowX}px ${shadowY}px 0 ${c(shadow)});` : '';
  const rimLayer = rim
    ? `<div class="paper__layer" style="background:${c(rim)};clip-path:${tornPolygon(w, h, { seed, sides, amp })}"></div>`
    : '';
  const face = `<div class="paper__layer" style="background:${c(color)};clip-path:${tornPolygon(w, h, {
    seed: seed + 101, sides, amp: amp * 0.9, inset: rim ? 3.5 : 0,
  })}"></div>`;
  return `<div class="paper ${cls}" style="left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};transform:rotate(${rot}deg);z-index:${z};${filter}">${rimLayer}${face}<div class="paper__inner" style="${innerStyle}">${inner}</div></div>`;
}

/* ---- Ruban adhésif ------------------------------------------------------- */

export function tape({ x, y, w = 130, h = 38, rot = -6, color = 'cream-2', seed = 7, z = 6 }) {
  const R = rng(seed);
  const pts = [];
  const teeth = 6;
  for (let i = 0; i <= teeth; i += 1) pts.push([(i % 2 ? 5 : 0) + R() * 3, (h * i) / teeth]);
  for (let i = teeth; i >= 0; i -= 1) pts.push([w - (i % 2 ? 5 : 0) - R() * 3, (h * i) / teeth]);
  const clip = `polygon(${pts.map(([a, b]) => `${px(a)} ${px(b)}`).join(',')})`;
  /* Liserés le long des bords : le ruban reste lisible même sur un papier de même teinte. */
  const edge = color === 'ink' ? 'rgba(244,240,232,.22)' : 'rgba(20,20,20,.16)';
  const bg = `linear-gradient(${edge} 0 2px,transparent 2px calc(100% - 2px),${edge} 0),${c(color)}`;
  return `<div class="tape" style="left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};transform:rotate(${rot}deg);background:${bg};clip-path:${clip};z-index:${z}"></div>`;
}

/* ---- Trame de points (halftone) ----------------------------------------- */

/**
 * field(u, v) renvoie 0..1 (u, v = position relative dans la zone) : la taille
 * des points suit ce champ. Grille en quinconce, façon impression offset.
 */
export function halftone({ x, y, w, h, step = 16, rMax = 6, color = 'ink', field, z = 1, rot = 0 }) {
  const dots = [];
  let row = 0;
  for (let py = 0; py <= h + step; py += step * 0.866, row += 1) {
    for (let pxx = row % 2 ? step / 2 : 0; pxx <= w + step; pxx += step) {
      const f = Math.max(0, Math.min(1, field(pxx / w, py / h)));
      const rr = rMax * f;
      if (rr >= 0.7) dots.push(`<circle cx="${r1(pxx)}" cy="${r1(py)}" r="${r1(rr)}"/>`);
    }
  }
  return `<svg class="layer" style="left:${px(x)};top:${px(y)};z-index:${z};transform:rotate(${rot}deg)" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><g fill="${c(color)}">${dots.join('')}</g></svg>`;
}

/** Champs prêts à l'emploi pour halftone(). */
export const fields = {
  /** Gros points dans un coin, qui s'effacent vers l'opposé. corner = [u, v]. */
  corner: ([cu, cv], reach = 1) => (u, v) => 1 - Math.hypot(u - cu, v - cv) / reach,
  /** Disque : plein au centre, s'efface vers le bord. */
  disc: (inner = 0.15) => (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    return d > 1 ? 0 : 1 - Math.max(0, d - inner) / (1 - inner);
  },
  /** Dégradé linéaire : 0 en haut, 1 en bas (ou inversé). */
  linear: (dir = 'down') => (u, v) => (dir === 'down' ? v : dir === 'up' ? 1 - v : dir === 'right' ? u : 1 - u),
};

/* ---- Coups de marqueur --------------------------------------------------- */

/** Courbe lisse (Catmull-Rom) passant par tous les points. */
export function smooth(points) {
  if (points.length < 2) return '';
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

const jitter = (pts, R, j) => pts.map(([x, y], i) => (i === 0 || i === pts.length - 1)
  ? [x, y]
  : [x + (R() - 0.5) * 2 * j, y + (R() - 0.5) * 2 * j]);

const quad = (p0, p1, p2, t) => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
];

/** Trait main levée de p0 à p2 (p1 = point de contrôle). */
export function stroke(p0, p1, p2, { seed = 3, wobble = 2.5, n = 7 } = {}) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i <= n; i += 1) pts.push(quad(p0, p1, p2, i / n));
  return smooth(jitter(pts, R, wobble));
}

/** Flèche main levée (courbe + pointe ouverte). */
export function arrow(p0, p1, p2, { seed = 5, head = 30, spread = 0.5, wobble = 2.5 } = {}) {
  const body = stroke(p0, p1, p2, { seed, wobble });
  const end = p2;
  const prev = quad(p0, p1, p2, 0.9);
  const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const R = rng(seed + 9);
  const wing = (s) => {
    const aa = a + Math.PI + s * (spread + (R() - 0.5) * 0.15);
    const len = head * (0.9 + R() * 0.2);
    return `M${r1(end[0])} ${r1(end[1])} L${r1(end[0] + Math.cos(aa) * len)} ${r1(end[1] + Math.sin(aa) * len)}`;
  };
  return `${body} ${wing(1)} ${wing(-1)}`;
}

/** Cercle entouré au marqueur (un peu plus d'un tour, qui ne se referme pas pile). */
export function loop(cx, cy, rx, ry, { seed = 11, turns = 1.12, start = -2.3, rot = -0.08, n = 26 } = {}) {
  const R = rng(seed);
  const pts = [];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const a = start + t * Math.PI * 2 * turns;
    const k = 1 + (t - 0.5) * 0.09 + (R() - 0.5) * 0.035;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }
  return smooth(pts);
}

/** Soulignement griffonné (aller-retour). */
export function underline(x1, x2, y, { seed = 13, passes = 2, slope = -6, gap = 13 } = {}) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i < passes; i += 1) {
    const yy = y + i * gap;
    const a = i % 2 ? [x2 - R() * 18, yy + slope * 0.5] : [x1 + R() * 10, yy];
    const b = i % 2 ? [x1 + 20 + R() * 20, yy + slope + 4] : [x2 - R() * 6, yy + slope];
    pts.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (R() - 0.5) * 6], b);
  }
  return smooth(pts);
}

/** Traits d'impact rayonnants autour d'un point. */
export function burst(cx, cy, r1v, r2v, { count = 5, from = -2.6, to = -0.5, seed = 17 } = {}) {
  const R = rng(seed);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const a = from + ((to - from) * i) / Math.max(1, count - 1) + (R() - 0.5) * 0.12;
    const a1 = r1v * (0.92 + R() * 0.16);
    const a2 = r2v * (0.88 + R() * 0.2);
    out.push(`M${r1(cx + Math.cos(a) * a1)} ${r1(cy + Math.sin(a) * a1)} L${r1(cx + Math.cos(a) * a2)} ${r1(cy + Math.sin(a) * a2)}`);
  }
  return out.join(' ');
}

/** Coche manuscrite. */
export function check(x, y, s = 40, { seed = 19 } = {}) {
  const R = rng(seed);
  const p = [[x, y], [x + s * 0.35 + R() * 3, y + s * 0.38], [x + s, y - s * 0.55 + R() * 4]];
  return smooth([p[0], [x + s * 0.18, y + s * 0.2], p[1], [x + s * 0.65, y - s * 0.08], p[2]]);
}

/** Zigzag (ressort, électricité). */
export function zigzag(x, y, w, h, { n = 6, seed = 23 } = {}) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i <= n; i += 1) pts.push([x + (w * i) / n + (R() - 0.5) * 4, y + (i % 2 ? h : 0) + (R() - 0.5) * 4]);
  return `M${pts.map(([a, b]) => `${r1(a)} ${r1(b)}`).join(' L')}`;
}

/** Calque SVG plein cadre contenant des traits de marqueur. */
export function marker(paths, { color = 'ink', width = 8, z = 7 } = {}) {
  const list = Array.isArray(paths) ? paths : [paths];
  const body = list.map((p) => (typeof p === 'string'
    ? `<path d="${p}"/>`
    : `<path d="${p.d}" stroke-width="${p.width}"/>`)).join('');
  return `<svg class="layer" style="left:0;top:0;z-index:${z}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g fill="none" stroke="${c(color)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

/* ---- Typo ----------------------------------------------------------------- */

/**
 * Mot en Bebas Neue ajusté à une largeur (fit) sans dépasser une taille (max).
 * vertical : le mot se lit de bas en haut, ajusté à une hauteur.
 */
export function word(text, { fit, max = 400, color = 'ink', cls = '', style = '', vertical = false } = {}) {
  return `<span class="word ${vertical ? 'word--v' : ''} ${cls}" data-fit="${fit}" data-max="${max}" ${vertical ? 'data-axis="h"' : ''} style="color:${c(color)};${style}">${esc(text)}</span>`;
}

/** Bloc positionné en absolu. */
export const box = (x, y, inner, style = '') => `<div class="abs" style="left:${px(x)};top:${px(y)};${style}">${inner}</div>`;

/* ---- Stickers ------------------------------------------------------------- */

const STICKER = {
  lime: { bg: 'lime', fg: 'ink', sub: 'ink' },
  ink: { bg: 'ink', fg: 'lime', sub: 'cream' },
  cream: { bg: 'cream', fg: 'ink', sub: 'grey' },
};

/**
 * Sticker rectangulaire incliné : lignes en Bebas, mention « HT » discrète.
 * shadow : couleur de l'ombre dure (ink sur fond clair, cream ou lime sur fond noir).
 */
export function sticker({ x, y, lines, variant = 'lime', rot = 3, size = 52, shadow = 'ink', sub = '', z = 8, align = 'left', anchor = 'left', pad = '' }) {
  const v = STICKER[variant];
  const body = lines.map((l, i) => {
    const ht = sub && i === lines.length - 1 ? `<span class="sticker__sub" style="color:${c(v.sub)}">${sub}</span>` : '';
    return `<span class="sticker__line" style="${i ? `font-size:${r1(size * 0.62)}px` : ''}">${l}${ht}</span>`;
  }).join('');
  const pos = anchor === 'right' ? `right:${px(W - x)}` : `left:${px(x)}`;
  return `<div class="sticker" style="${pos};top:${px(y)};z-index:${z};font-size:${size}px;background:${c(v.bg)};color:${c(v.fg)};box-shadow:7px 7px 0 ${c(shadow)};transform:rotate(${rot}deg);text-align:${align};${pad ? `padding:${pad};` : ''}">${body}</div>`;
}

/** Sticker rond (badge). */
export function roundSticker({ x, y, d = 140, lines, variant = 'cream', rot = -6, shadow = 'ink', size = 30, z = 9 }) {
  const v = STICKER[variant];
  return `<div class="sticker sticker--round" style="left:${px(x)};top:${px(y)};width:${d}px;height:${d}px;z-index:${z};font-size:${size}px;background:${c(v.bg)};color:${c(v.fg)};box-shadow:6px 6px 0 ${c(shadow)};transform:rotate(${rot}deg)">${lines.map((l) => `<span>${l}</span>`).join('')}</div>`;
}

/* ---- Pictogramme ---------------------------------------------------------- */

/**
 * Pictogramme du sprite (déjà extrait en <svg>), taille et couleur de trait.
 * Sans x / y, il reste dans le flux (dans une tuile ou un papier).
 */
export function icon(svg, { x, y, size = 120, color = 'ink', strokeWidth = 2.2, rot = 0, z = 5 } = {}) {
  const pos = x === undefined ? 'position:relative;flex:none' : `left:${px(x)};top:${px(y)}`;
  return `<div class="icon" style="${pos};width:${size}px;height:${size}px;color:${c(color)};transform:rotate(${rot}deg);z-index:${z}">${svg.replace('stroke-width="2"', `stroke-width="${strokeWidth}"`)}</div>`;
}

/** Carré cartonné à bord noir et ombre dure (pour poser un pictogramme). */
export function tile({ x, y, w, h = w, bg = 'cream', rot = -3, shadow = 'ink', inner = '', z = 5, radius = 4 }) {
  return `<div class="tile" style="left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};background:${c(bg)};border-radius:${radius === '50%' ? '50%' : `${radius}px`};box-shadow:7px 7px 0 ${c(shadow)};transform:rotate(${rot}deg);z-index:${z}">${inner}</div>`;
}

/* ---- Signature ------------------------------------------------------------ */

/** Petit tampon « GJS » + numéro d'affiche. */
export function mark({ x, y, n, variant = 'ink', numColor = 'ink', anchor = 'left', z = 9, rot = 0 }) {
  const v = STICKER[variant];
  const pos = anchor === 'right' ? `right:${px(W - x)};flex-direction:row-reverse` : `left:${px(x)}`;
  return `<div class="mark" style="${pos};top:${px(y)};z-index:${z};transform:rotate(${rot}deg)"><span class="mark__logo" style="background:${c(v.bg)};color:${c(v.fg)}">GJS</span><span class="mark__num" style="color:${c(numColor)}">N°${n}</span></div>`;
}

/** Ligne d'accroche (Poppins). */
export function tagline(text, { x, y, w, size = 25, color = 'ink', weight = 600, z = 6, rot = 0, style = '' }) {
  return `<p class="tagline" style="left:${px(x)};top:${px(y)};width:${px(w)};font-size:${size}px;font-weight:${weight};color:${c(color)};z-index:${z};transform:rotate(${rot}deg);${style}">${text_(text)}</p>`;
}

/** Texte courant échappé, sans coupure au trait d'union (« e-commerce » reste entier). */
export const text_ = (s) => esc(s).replace(/(\S+-\S+)/g, '<span style="white-space:nowrap">$1</span>');
