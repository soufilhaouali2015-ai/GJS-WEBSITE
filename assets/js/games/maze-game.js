/* ==========================================================================
   GJS ARCADE · JEU 3 : « Lead Rush » (labyrinthe d'arcade, 60 secondes)
   Le joueur est la pastille GJS, les points sont des « leads », les ennemis
   sont les ennemis du marketing (reconnaissables à leur forme).

   Moteur :
   • Déplacement case par case : chaque entité part d'une case (tx, ty) vers
     sa voisine avec une progression t ∈ [0, 1[ → interpolation fluide.
   • Mémoire de direction : la direction demandée est exécutée dès qu'elle
     devient possible (à l'arrivée sur une case) ; demi-tour immédiat.
   • Tunnel latéral (rangée 8) : la coordonnée x boucle sur la largeur.
   • IA aux intersections : distance à une cible propre à chaque ennemi,
     sans demi-tour ; cartes de distance (parcours en largeur) pour sortir
     de la base et y revenir une fois capturé.
   ========================================================================== */

import { createLoop, createCanvas, createInput, createPad, createParticles, saveBest, PALETTE, FONT_DISPLAY, FONT_TEXT, pick } from './utils.js';

const C = PALETTE;

const MAP = [
  '#####################',
  '#o........#........o#',
  '#.###.###.#.###.###.#',
  '#...................#',
  '#.###.#.#####.#.###.#',
  '#.....#...#...#.....#',
  '#####.### # ###.#####',
  '#####.#       #.#####',
  '     .  ##-##  .     ',
  '#####.# #EEE# #.#####',
  '#####.# ##### #.#####',
  '#####.#       #.#####',
  '#####.# ##### #.#####',
  '#.........P.........#',
  '#.###.###.#.###.###.#',
  '#o..#.....#.....#..o#',
  '###.#.#.#####.#.#.###',
  '#.....#...#...#.....#',
  '#.#######.#.#######.#',
  '#...................#',
  '#####################',
];
const W = MAP[0].length;
const H = MAP.length;
const DURATION = 60;
const FRIGHT = 6;
const EXIT = [10, 7];
const HOME = [10, 9];
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const DIR_LIST = [[0, -1], [-1, 0], [0, 1], [1, 0]];

// Charte stricte : les ennemis se distinguent par leur forme et leur motif
const ENEMIES = [
  { id: 'google', name: 'Algorithme Google', hint: 'vous poursuit sans relâche', shape: 'diamond', fill: 'solid', behavior: 'chase', start: [10, 7], release: 1.2 },
  { id: 'concurrent', name: 'Concurrent', hint: 'vise 4 cases devant vous', shape: 'triangle', fill: 'stripes', behavior: 'ambush', start: [9, 9], release: 3.5 },
  { id: 'rebond', name: 'Taux de rebond', hint: 'imprévisible', shape: 'circle', fill: 'ring', behavior: 'random', start: [10, 9], release: 6.5 },
  { id: 'budget', name: 'Budget gaspillé', hint: 'patrouille, puis fonce', shape: 'hexagon', fill: 'dots', behavior: 'patrol', start: [11, 9], release: 9.5 },
];
const PATROL = [[15, 13], [19, 15], [19, 19], [13, 17]];

const wrapX = (x) => (x + W) % W;
const cell = (x, y) => (y < 0 || y >= H ? '#' : MAP[y][wrapX(x)]);

function passable(x, y, enemyMode = null) {
  const c = cell(x, y);
  if (c === '#') return false;
  if (c === '-') return enemyMode === 'leaving' || enemyMode === 'eaten' || enemyMode === 'house';
  return true;
}

/** Carte de distance (parcours en largeur, portes autorisées) vers une case cible. */
function distanceMap([tx, ty]) {
  const dist = Array.from({ length: H }, () => new Array(W).fill(Infinity));
  dist[ty][tx] = 0;
  const queue = [[tx, ty]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of DIR_LIST) {
      const nx = wrapX(x + dx);
      const ny = y + dy;
      if (!passable(nx, ny, 'eaten') || dist[ny][nx] !== Infinity) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

export function create(api) {
  const { stage, sound } = api;
  stage.classList.add('maze-stage');
  stage.innerHTML = `
    <div class="maze-board" data-board></div>
    <aside class="maze-legend" aria-label="Légende">
      <p class="maze-legend__title">Ennemis</p>
      <ul>${ENEMIES.map((e) => `<li><span class="maze-legend__swatch maze-legend__swatch--${e.shape} maze-legend__swatch--${e.fill}"></span><span><strong>${e.name}</strong><br><span class="t-muted">${e.hint}</span></span></li>`).join('')}
        <li><span class="maze-legend__swatch maze-legend__swatch--power"></span><span><strong>Agent IA</strong><br><span class="t-muted">6 s pour capturer les ennemis</span></span></li>
      </ul>
    </aside>
    <p class="maze-tooltip" data-tooltip hidden></p>`;
  const board = stage.querySelector('[data-board]');
  const tooltip = stage.querySelector('[data-tooltip]');
  const view = createCanvas(board, 'maze-canvas');
  const { ctx } = view;
  const particles = createParticles();
  const toExit = distanceMap(EXIT);
  const toHome = distanceMap(HOME);

  // État
  let leads = new Set();
  let powers = new Set();
  const resetItems = () => {
    leads = new Set();
    powers = new Set();
    MAP.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') leads.add(`${x},${y}`);
      if (c === 'o') powers.add(`${x},${y}`);
    }));
  };
  resetItems();

  const player = { tx: 10, ty: 13, dx: 0, dy: 0, t: 0, want: null, last: [-1, 0], speed: 6.3 };
  const enemies = ENEMIES.map((def) => ({
    ...def, tx: def.start[0], ty: def.start[1], dx: 0, dy: 0, t: 0,
    mode: 'house', frightened: false, releaseAt: def.release, bob: Math.random() * 6,
  }));
  const s = { elapsed: 0, fright: 0, chain: 0, score: 0, collected: 0, captures: 0, over: false, hudT: 0, waves: 0 };

  // Géométrie
  const g = { ts: 20, ox: 0, oy: 0, walls: null };

  // Murs pré-rendus dans un canvas hors écran : des blocs de papier crème foncé
  // découpés, cernés d'un seul trait d'encre (comme nos stickers)
  function prerenderWalls() {
    const dpr = view.size.dpr;
    const off = document.createElement('canvas');
    off.width = Math.ceil(g.ts * W * dpr);
    off.height = Math.ceil(g.ts * H * dpr);
    const c = off.getContext('2d');
    c.scale(dpr, dpr);
    const ts = g.ts;
    const open = (nx, ny) => ny >= 0 && ny < H && nx >= 0 && nx < W && MAP[ny][nx] !== '#';
    c.fillStyle = C.cream2;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) if (MAP[y][x] === '#') c.fillRect(x * ts, y * ts, ts, ts);
    }
    c.strokeStyle = C.ink;
    c.lineWidth = Math.max(1.5, ts / 9);
    c.lineCap = 'square';
    c.beginPath();
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (MAP[y][x] !== '#') continue;
        const x0 = x * ts; const y0 = y * ts; const x1 = x0 + ts; const y1 = y0 + ts;
        if (open(x, y - 1)) { c.moveTo(x0, y0); c.lineTo(x1, y0); }
        if (open(x, y + 1)) { c.moveTo(x0, y1); c.lineTo(x1, y1); }
        if (open(x - 1, y)) { c.moveTo(x0, y0); c.lineTo(x0, y1); }
        if (open(x + 1, y)) { c.moveTo(x1, y0); c.lineTo(x1, y1); }
      }
    }
    c.stroke();
    // Porte de la base
    c.strokeStyle = C.ink2;
    c.lineWidth = Math.max(1.5, ts / 10);
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(10 * ts, 8.5 * ts);
    c.lineTo(11 * ts, 8.5 * ts);
    c.stroke();
    g.walls = off;
  }

  const layout = () => {
    const { w, h } = view.size;
    g.ts = Math.max(8, Math.floor(Math.min(w / W, h / H)));
    g.ox = Math.floor((w - g.ts * W) / 2);
    g.oy = Math.floor((h - g.ts * H) / 2);
    prerenderWalls();
  };

  layout();
  view.canvas.onfit = layout;

  /* ---------- Joueur ---------- */

  const eat = (x, y) => {
    const key = `${x},${y}`;
    if (leads.delete(key)) {
      s.score += 10;
      s.collected += 1;
      if (s.collected % 4 === 0) sound.tone(660 + (s.collected % 8) * 20, 0.04, 'square', 0.18);
      if (!leads.size && !powers.size) {
        s.waves += 1;
        s.score += 500;
        resetItems();
        api.live('Nouvelle vague de leads ! Plus 500 points.');
      }
    }
    if (powers.delete(key)) {
      s.score += 50;
      s.fright = FRIGHT;
      s.chain = 0;
      sound.power();
      enemies.forEach((e) => {
        if (e.mode === 'active' || e.mode === 'leaving') {
          e.frightened = true;
          if (e.mode === 'active' && (e.dx || e.dy)) { e.tx = wrapX(e.tx + e.dx); e.ty += e.dy; e.dx = -e.dx; e.dy = -e.dy; e.t = 1 - e.t; }
        }
      });
      api.live('Agent IA activé : les ennemis sont capturables pendant 6 secondes.');
    }
  };

  const updatePlayer = (dt) => {
    const p = player;
    if (p.want && (p.dx || p.dy) && p.want[0] === -p.dx && p.want[1] === -p.dy) {
      // Demi-tour immédiat
      p.tx = wrapX(p.tx + p.dx);
      p.ty += p.dy;
      p.dx = -p.dx;
      p.dy = -p.dy;
      p.t = 1 - p.t;
    }
    if (!p.dx && !p.dy) {
      if (p.want && passable(p.tx + p.want[0], p.ty + p.want[1])) {
        [p.dx, p.dy] = p.want;
        p.t = 0;
      } else return;
    }
    p.t += p.speed * dt;
    while (p.t >= 1) {
      p.t -= 1;
      p.tx = wrapX(p.tx + p.dx);
      p.ty += p.dy;
      eat(p.tx, p.ty);
      if (p.want && passable(p.tx + p.want[0], p.ty + p.want[1])) [p.dx, p.dy] = p.want;
      if (!passable(p.tx + p.dx, p.ty + p.dy)) { p.dx = 0; p.dy = 0; p.t = 0; break; }
    }
    if (p.dx || p.dy) p.last = [p.dx, p.dy];
  };

  /* ---------- Ennemis ---------- */

  const targetFor = (e) => {
    const p = player;
    switch (e.behavior) {
      case 'chase': return [p.tx, p.ty];
      case 'ambush': return [p.tx + p.last[0] * 4, p.ty + p.last[1] * 4];
      case 'patrol': {
        const near = Math.abs(p.tx - e.tx) + Math.abs(p.ty - e.ty) < 7;
        const phase = s.elapsed % 16 < 7;
        if (phase && !near) return PATROL[Math.floor(s.elapsed / 1.8) % PATROL.length];
        return [p.tx, p.ty];
      }
      default: return [p.tx, p.ty];
    }
  };

  const decide = (e) => {
    const options = DIR_LIST.filter(([dx, dy]) => !(dx === -e.dx && dy === -e.dy && (e.dx || e.dy)) && passable(e.tx + dx, e.ty + dy, e.mode));
    if (!options.length) { e.dx = -e.dx; e.dy = -e.dy; return; }
    let choice;
    if (e.mode === 'leaving' || e.mode === 'eaten') {
      const map = e.mode === 'leaving' ? toExit : toHome;
      choice = options.reduce((best, d) => (map[e.ty + d[1]][wrapX(e.tx + d[0])] < map[e.ty + best[1]][wrapX(e.tx + best[0])] ? d : best), options[0]);
    } else if (e.frightened || (e.behavior === 'random' && Math.random() < 0.7)) {
      choice = pick(options);
    } else {
      const [gx, gy] = targetFor(e);
      let best = Infinity;
      options.forEach((d) => {
        const nx = e.tx + d[0];
        const ny = e.ty + d[1];
        const dist = (nx - gx) ** 2 + (ny - gy) ** 2;
        if (dist < best) { best = dist; choice = d; }
      });
    }
    [e.dx, e.dy] = choice;
  };

  const enemySpeed = (e) => {
    if (e.mode === 'eaten') return 11;
    let v = e.frightened ? 3.3 : Math.min(5.9, 4.5 + s.elapsed * 0.024);
    if (e.ty === 8 && (e.tx <= 4 || e.tx >= 16)) v *= 0.6; // ralentissement dans le tunnel
    if (e.mode === 'leaving') v = 4;
    return v;
  };

  const updateEnemy = (e, dt) => {
    if (e.mode === 'house') {
      e.bob += dt * 6;
      if (s.elapsed >= e.releaseAt) {
        e.dx = 0; e.dy = 0; e.t = 0;
        // Déjà devant la porte : il part directement en chasse
        if (e.tx === EXIT[0] && e.ty === EXIT[1]) { e.mode = 'active'; e.dx = pick([-1, 1]); } else { e.mode = 'leaving'; decide(e); }
      }
      return;
    }
    if (!e.dx && !e.dy) decide(e);
    e.t += enemySpeed(e) * dt;
    while (e.t >= 1) {
      e.t -= 1;
      e.tx = wrapX(e.tx + e.dx);
      e.ty += e.dy;
      if (e.mode === 'leaving' && e.tx === EXIT[0] && e.ty === EXIT[1]) { e.mode = 'active'; e.dx = pick([-1, 1]); e.dy = 0; }
      if (e.mode === 'eaten' && e.tx === HOME[0] && e.ty === HOME[1]) {
        e.mode = 'house';
        e.dx = 0; e.dy = 0; e.t = 0;
        e.releaseAt = s.elapsed + 2.5;
        return;
      }
      decide(e);
      if (!e.dx && !e.dy) { e.t = 0; break; }
    }
  };

  const posOf = (en) => [en.tx + en.dx * en.t, en.ty + en.dy * en.t];
  const dist = (a, b) => {
    let dx = Math.abs(a[0] - b[0]);
    if (dx > W / 2) dx = W - dx;
    return Math.hypot(dx, a[1] - b[1]);
  };

  /* ---------- Fin de partie ---------- */

  let endTimer = 0;
  const finish = (won, enemy) => {
    s.over = true;
    const time = Math.min(DURATION, Math.floor(s.elapsed));
    const final = s.score + (won ? 1000 : 0);
    const isRecord = saveBest('maze', final, `${final} pts`);
    if (won) sound.win(); else sound.hit();
    if (!won) {
      const [x, y] = posOf(player);
      particles.burst(g.ox + (x + 0.5) * g.ts, g.oy + (y + 0.5) * g.ts, { count: 70, colors: [C.lime, C.ink, C.cream], speed: 260, size: 7, life: 1 });
    }
    endTimer = setTimeout(() => {
      loop.stop();
      api.end(won ? {
        won: true,
        title: 'Vous avez tenu 60 s. <span class="hl">Nous, on tient sur la durée.</span>',
        detail: `${s.collected} leads collectés, ${s.captures} ennemi${s.captures > 1 ? 's' : ''} capturé${s.captures > 1 ? 's' : ''}, +1 000 points de survie.`,
        score: final,
        scoreLabel: `Score : ${final}`,
        isRecord,
        message: 'Imaginez le résultat avec une vraie stratégie d’acquisition.',
        cta: { label: 'Générer de vrais leads', href: 'contact.html?besoins=acquisition,sea#formulaire' },
      } : {
        won: false,
        title: `Mangé par <span class="hl">${enemy.name}</span>.`,
        detail: `Vous avez tenu ${time} s et collecté ${s.collected} leads.`,
        score: final,
        scoreLabel: `Score : ${final}`,
        isRecord,
        message: 'Avec GJS, ça n’arrive pas.',
        cta: { label: 'Protéger mes leads', href: 'contact.html?besoins=acquisition,sea#formulaire' },
      });
    }, won ? 600 : 1000);
  };

  /* ---------- Boucle ---------- */

  const hud = () => {
    const left = Math.max(0, DURATION - s.elapsed);
    const secs = Math.ceil(left);
    api.hud(`<span>Temps <strong>${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}</strong></span><span>Leads ${s.collected}</span><span>Score ${s.score}</span>${s.fright > 0 ? '<span class="hud-shield">Agent IA</span>' : ''}`);
  };

  const update = (dt) => {
    particles.update(dt);
    if (s.over) return;
    s.elapsed += dt;
    if (s.fright > 0) {
      s.fright -= dt;
      if (s.fright <= 0) enemies.forEach((e) => { e.frightened = false; });
    }
    updatePlayer(dt);
    enemies.forEach((e) => updateEnemy(e, dt));
    const pp = posOf(player);
    for (const e of enemies) {
      if (e.mode !== 'active' && e.mode !== 'leaving') continue;
      if (dist(pp, posOf(e)) > 0.62) continue;
      if (e.frightened) {
        e.frightened = false;
        e.mode = 'eaten';
        const gain = 200 * 2 ** s.chain;
        s.chain += 1;
        s.score += gain;
        s.captures += 1;
        sound.coin();
        particles.burst(g.ox + (pp[0] + 0.5) * g.ts, g.oy + (pp[1] + 0.5) * g.ts, { count: 30, colors: [C.lime, C.ink], speed: 200, size: 6, life: 0.7 });
        api.live(`${e.name} capturé : plus ${gain} points.`);
      } else {
        api.alert(`Mangé par ${e.name}.`);
        finish(false, e);
        return;
      }
    }
    if (s.elapsed >= DURATION) { finish(true); return; }
    s.hudT -= dt;
    if (s.hudT <= 0) { s.hudT = 0.2; hud(); }
  };

  /* ---------- Rendu ---------- */

  const shapePath = (shape, x, y, r) => {
    ctx.beginPath();
    if (shape === 'diamond') {
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    } else if (shape === 'triangle') {
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.8); ctx.lineTo(x - r * 0.95, y + r * 0.8); ctx.closePath();
    } else if (shape === 'hexagon') {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    }
  };

  // Motif propre à chaque ennemi (plein, rayé, anneau, pois) : lisible sans couleur
  const paintEnemy = (e, x, y, r) => {
    shapePath(e.shape, x, y, r);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.save();
    shapePath(e.shape, x, y, r);
    ctx.clip();
    ctx.fillStyle = C.cream;
    if (e.fill === 'stripes') {
      for (let k = -2; k <= 2; k += 1) ctx.fillRect(x - r, y + k * r * 0.42 - r * 0.07, r * 2, r * 0.14);
    } else if (e.fill === 'ring') {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.52, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.16;
      ctx.strokeStyle = C.cream;
      ctx.stroke();
    } else if (e.fill === 'dots') {
      [[-0.4, 0.42], [0.4, 0.42], [0, 0.72]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r * 0.6, r * 0.11, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.restore();
  };

  const render = () => {
    const { w, h } = view.size;
    const ts = g.ts;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, w, h);

    // Compte à rebours géant en filigrane
    const left = Math.max(0, Math.ceil(DURATION - s.elapsed));
    ctx.font = `400 ${Math.round(ts * 10)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = left <= 10 ? 'rgba(20,20,20,0.16)' : 'rgba(20,20,20,0.07)';
    ctx.fillText(String(left).padStart(2, '0'), w / 2, h / 2 + ts * 0.5);

    if (g.walls) ctx.drawImage(g.walls, g.ox, g.oy, ts * W, ts * H);

    const cx = (x) => g.ox + (x + 0.5) * ts;
    const cy = (y) => g.oy + (y + 0.5) * ts;

    // Leads
    ctx.fillStyle = C.ink;
    const ls = Math.max(2, ts * 0.16);
    leads.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      ctx.save();
      ctx.translate(cx(x), cy(y));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-ls / 2, -ls / 2, ls, ls);
      ctx.restore();
    });

    // Agents IA : pastilles citron cerclées d'encre, qui battent
    const pulse = 0.82 + 0.18 * Math.sin(s.elapsed * 6);
    powers.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      ctx.beginPath();
      ctx.arc(cx(x), cy(y), ts * 0.36 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = C.lime;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, ts * 0.08);
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      if (ts >= 18) {
        ctx.fillStyle = C.ink;
        ctx.font = `600 ${Math.round(ts * 0.3)}px ${FONT_TEXT}`;
        ctx.fillText('IA', cx(x), cy(y) + 1);
      }
    });

    // Ennemis
    enemies.forEach((e) => {
      let [x, y] = posOf(e);
      if (e.mode === 'house') y += Math.sin(e.bob) * 0.15;
      if (x < -0.5) x += W;
      if (x > W - 0.5) x -= W;
      const px = cx(x);
      const py = cy(y);
      const r = ts * 0.42;
      if (e.mode !== 'eaten') {
        const blink = e.frightened && s.fright < 1.5 && Math.floor(s.elapsed * 8) % 2 === 0;
        if (e.frightened) {
          // Capturable : silhouette citron en pointillés
          shapePath(e.shape, px, py, r);
          ctx.fillStyle = blink ? C.cream : C.lime;
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          paintEnemy(e, px, py, r);
        }
      }
      // Yeux (regard dans la direction du mouvement)
      const ex = (e.dx || 0) * r * 0.25;
      const ey = (e.dy || 0) * r * 0.25;
      ctx.fillStyle = e.frightened ? C.ink : C.lime;
      if (e.mode === 'eaten') ctx.fillStyle = C.ink;
      ctx.fillRect(px - r * 0.38 + ex, py - r * 0.18 + ey, r * 0.24, r * 0.24);
      ctx.fillRect(px + r * 0.14 + ex, py - r * 0.18 + ey, r * 0.24, r * 0.24);
    });

    // Joueur : pastille GJS (sticker citron, liseré noir)
    if (!s.over || Math.floor(s.elapsed * 10) % 2 === 0) {
      let [x, y] = posOf(player);
      if (x < -0.5) x += W;
      if (x > W - 0.5) x -= W;
      const px = cx(x);
      const py = cy(y);
      ctx.beginPath();
      ctx.arc(px + ts * 0.08, py + ts * 0.08, ts * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, ts * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = C.lime;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1.5, ts * 0.08);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = `400 ${Math.round(ts * (ts >= 24 ? 0.36 : 0.52))}px ${FONT_DISPLAY}`;
      ctx.fillText(ts >= 24 ? 'GJS' : 'G', px, py + 1);
    }

    particles.render(ctx);
  };

  const loop = createLoop(update, render);

  // Survol : nom de l'ennemi sous le curseur
  const onHover = (e) => {
    const rect = view.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - g.ox) / g.ts - 0.5;
    const my = (e.clientY - rect.top - g.oy) / g.ts - 0.5;
    const hit = enemies.find((en) => dist(posOf(en), [mx, my]) < 0.8);
    if (hit) {
      tooltip.hidden = false;
      tooltip.textContent = `${hit.name} · ${hit.hint}`;
      tooltip.style.left = `${e.clientX - stage.getBoundingClientRect().left + 14}px`;
      tooltip.style.top = `${e.clientY - stage.getBoundingClientRect().top + 14}px`;
    } else tooltip.hidden = true;
  };
  view.canvas.addEventListener('pointermove', onHover);

  const onDir = (dir) => {
    if (s.over) return;
    player.want = DIRS[dir];
  };
  const offInput = createInput(stage, { onDir, repeat: true });
  const offPad = api.touch ? createPad(stage, ['up', 'left', 'down', 'right'], onDir) : () => {};

  render();
  hud();

  return {
    start() { loop.start(); api.live('Survivez 60 secondes. Collectez les leads, évitez les ennemis.'); },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() {
      clearTimeout(endTimer);
      loop.stop();
      offInput();
      offPad();
      view.canvas.removeEventListener('pointermove', onHover);
      view.destroy();
      stage.classList.remove('maze-stage');
      stage.innerHTML = '';
    },
  };
}
