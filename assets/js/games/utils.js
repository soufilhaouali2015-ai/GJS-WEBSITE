/* ==========================================================================
   GJS ARCADE — UTILITAIRES DE JEU
   Boucle rAF à delta borné, canvas HiDPI, entrées clavier / swipe / pad
   virtuel, sons synthétisés (Web Audio), particules, records.
   ========================================================================== */

import { store } from '../core/utils.js';

/* ---------- Boucle de jeu ------------------------------------------------- */

/**
 * Boucle requestAnimationFrame avec delta time borné (pas de « téléportation »
 * après un onglet en arrière-plan ou une saccade).
 */
export function createLoop(update, render) {
  let id = 0;
  let last = 0;
  let running = false;
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    update(dt);
    render();
    id = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      id = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(id);
    },
    get running() { return running; },
  };
}

/* ---------- Canvas HiDPI --------------------------------------------------- */

export function createCanvas(parent, className = 'game-canvas') {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0, dpr: 1 };
  const fit = () => {
    const rect = parent.getBoundingClientRect();
    size.dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = Math.max(1, Math.round(rect.width));
    size.h = Math.max(1, Math.round(rect.height));
    canvas.width = size.w * size.dpr;
    canvas.height = size.h * size.dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  };
  fit();
  const ro = new ResizeObserver(() => { fit(); if (canvas.onfit) canvas.onfit(size); });
  ro.observe(parent);
  return { canvas, ctx, size, fit, destroy: () => { ro.disconnect(); canvas.remove(); } };
}

/* ---------- Entrées -------------------------------------------------------- */

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', q: 'left', d: 'right', w: 'up', z: 'up', s: 'down',
  A: 'left', Q: 'left', D: 'right', W: 'up', Z: 'up', S: 'down',
};

/**
 * Entrées unifiées : onDir(dir) appelé sur flèches, ZQSD/WASD, swipe et pad.
 * Renvoie destroy().
 */
export function createInput(stage, { onDir, swipe = true, repeat = false }) {
  const onKey = (e) => {
    const dir = KEYMAP[e.key];
    if (!dir || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat && !repeat) return;
    onDir(dir);
  };
  let start = null;
  const onDown = (e) => {
    if (e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? 'right' : 'left');
    else onDir(dy > 0 ? 'down' : 'up');
  };
  window.addEventListener('keydown', onKey);
  if (swipe) {
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onUp);
  }
  return () => {
    window.removeEventListener('keydown', onKey);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointerup', onUp);
  };
}

/** Pad tactile (boutons ≥ 44 px). dirs : ['left','right'] ou les 4 directions. */
export function createPad(container, dirs, onDir) {
  const pad = document.createElement('div');
  pad.className = `game-pad game-pad--${dirs.length}`;
  const LABELS = { left: ['←', 'Gauche'], right: ['→', 'Droite'], up: ['↑', 'Haut'], down: ['↓', 'Bas'] };
  dirs.forEach((dir) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `game-pad__btn game-pad__btn--${dir}`;
    b.innerHTML = `<span aria-hidden="true">${LABELS[dir][0]}</span><span class="sr-only">${LABELS[dir][1]}</span>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); onDir(dir); });
    b.addEventListener('click', (e) => { if (e.detail === 0) onDir(dir); });
    pad.appendChild(b);
  });
  container.appendChild(pad);
  return () => pad.remove();
}

/* ---------- Sons synthétisés (Web Audio) ---------------------------------- */

let audio = null;
let master = null;
let enabled = false;

export const sound = {
  get enabled() { return enabled; },
  toggle() {
    enabled = !enabled;
    if (enabled && !audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audio = new Ctx();
        master = audio.createGain();
        master.gain.value = 0.18;
        master.connect(audio.destination);
      }
    }
    if (audio && audio.state === 'suspended') audio.resume();
    store.set('gjs-arcade-sound', enabled);
    return enabled;
  },
  restore() {
    if (store.get('gjs-arcade-sound', false) && !enabled) this.toggle();
  },
  tone(freq = 440, duration = 0.12, type = 'square', volume = 0.5, slide = 0) {
    if (!enabled || !audio) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  },
  noise(duration = 0.3, volume = 0.4) {
    if (!enabled || !audio) return;
    const len = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, len, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain).connect(master);
    src.start();
  },
  blip() { this.tone(880, 0.06, 'square', 0.3); },
  coin() { this.tone(988, 0.08, 'square', 0.35); setTimeout(() => this.tone(1319, 0.14, 'square', 0.35), 70); },
  power() { this.tone(220, 0.4, 'sawtooth', 0.4, 660); },
  hit() { this.noise(0.35, 0.6); this.tone(160, 0.3, 'sawtooth', 0.5, -120); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'square', 0.35), i * 110)); },
  count() { this.tone(440, 0.1, 'square', 0.3); },
  go() { this.tone(880, 0.25, 'square', 0.35); },
};

/* ---------- Particules ---------------------------------------------------- */

export function createParticles() {
  const list = [];
  return {
    burst(x, y, { count = 40, colors = ['#FFFFFF', '#5B85FF'], speed = 320, size = 3, life = 1 } = {}) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: size * (0.5 + Math.random()), color: colors[i % colors.length] });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 + 260 * dt;
      }
    },
    render(ctx) {
      for (const p of list) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    },
    get count() { return list.length; },
    clear() { list.length = 0; },
  };
}

/* ---------- Records -------------------------------------------------------- */

export function getBest(id) {
  return store.get(`gjs-arcade-${id}`);
}

/** Enregistre si meilleur. better(a, b) → true si a bat b. Renvoie true si record. */
export function saveBest(id, score, label, better = (a, b) => a > b) {
  const best = getBest(id);
  if (best && !better(score, best.score)) return false;
  store.set(`gjs-arcade-${id}`, { score, label, date: new Date().toISOString() });
  document.dispatchEvent(new CustomEvent('gjs:highscore', { detail: { id, score } }));
  return true;
}

/** Texte multi-lignes centré dans une boîte (canvas). */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

export const prefersTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
