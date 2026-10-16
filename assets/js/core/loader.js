/* ==========================================================================
   GJS — LOADER « SYSTÈME GJS »
   1. Champ d'étoiles Canvas 2D (3 profondeurs, scintillement)
   2. Vaisseau SVG en trajectoire sinusoïdale + traînée de particules
   3. « GJS » révélé dans le sillage du vaisseau (mask-image piloté en JS)
   4. Compteur 000 → 100 calé sur le chargement réel (polices + vidéo hero)
   5. Sortie : hyperespace (étoiles radiales) → flash → volets haut/bas

   Version complète à la 1re visite de la session, courte (≈1 s) ensuite,
   fondu simple en prefers-reduced-motion. Bouton « Passer » accessible.
   ========================================================================== */

import { CONFIG } from '../config.js';
import { env, store, clamp, rand, damp, announce, setInertOutside } from './utils.js';
import { lockScroll, unlockScroll } from './scroll.js';

const { gsap } = window;
const SESSION_KEY = 'gjs-visited';

/* ---------- Champ d'étoiles ------------------------------------------------ */

class Starfield {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.particles = [];
    this.warp = 0;           // 0 → 1 : passage en hyperespace
    this.resize();
    const count = clamp(Math.round((this.w * this.h) / 4200), 300, 500);
    const layers = [
      { speed: 14, size: 0.7, alpha: 0.45 },
      { speed: 38, size: 1.1, alpha: 0.7 },
      { speed: 90, size: 1.7, alpha: 0.95 },
    ];
    for (let i = 0; i < count; i += 1) {
      const layer = layers[i % 3];
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        layer,
        phase: Math.random() * Math.PI * 2,
        twinkle: rand(0.8, 2.6),
      });
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  emit(x, y, angle) {
    // Particules éjectées à l'opposé de la direction du vaisseau
    for (let i = 0; i < 3; i += 1) {
      const a = angle + Math.PI + rand(-0.32, 0.32);
      const speed = rand(60, 220);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 1,
        decay: rand(0.9, 1.7),
        size: rand(0.8, 2.6),
      });
    }
  }

  update(dt, time) {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    for (const s of this.stars) {
      const { layer } = s;
      if (this.warp > 0) {
        // Hyperespace : chaque étoile fuit le centre, la traînée s'allonge
        const dx = s.x - cx;
        const dy = s.y - cy;
        const k = 1 + this.warp * dt * 9 * (0.4 + layer.size);
        const nx = cx + dx * k;
        const ny = cy + dy * k;
        ctx.strokeStyle = `rgba(255,255,255,${layer.alpha})`;
        ctx.lineWidth = layer.size;
        ctx.beginPath();
        ctx.moveTo(s.x - (nx - s.x) * this.warp * 4, s.y - (ny - s.y) * this.warp * 4);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        s.x = nx;
        s.y = ny;
        if (s.x < -50 || s.x > w + 50 || s.y < -50 || s.y > h + 50) {
          s.x = cx + rand(-w * 0.2, w * 0.2);
          s.y = cy + rand(-h * 0.2, h * 0.2);
        }
      } else {
        s.x -= layer.speed * dt;
        if (s.x < -2) { s.x = w + 2; s.y = Math.random() * h; }
        const a = layer.alpha * (0.55 + 0.45 * Math.sin(time * s.twinkle + s.phase));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(s.x, s.y, layer.size, layer.size);
      }
    }

    // Traînée du réacteur (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      const r = p.size * (0.4 + p.life);
      ctx.fillStyle = p.life > 0.6 ? `rgba(255,255,255,${p.life})` : `rgba(91,133,255,${p.life * 1.4})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* ---------- Suivi du chargement réel ------------------------------------- */

function trackLoading(video) {
  const tasks = [];
  const add = (promise, weight) => {
    const task = { weight, done: false };
    tasks.push(task);
    Promise.resolve(promise).catch(() => {}).finally(() => { task.done = true; });
  };

  if (document.fonts && document.fonts.load) {
    add(Promise.all([
      document.fonts.load('600 100px "Clash Display"'),
      document.fonts.load('400 16px "General Sans"'),
      document.fonts.load('400 12px "JetBrains Mono"'),
      document.fonts.load('italic 400 40px "Instrument Serif"'),
    ]), 0.45);
  }

  if (video && !video.dataset.disabled) {
    add(new Promise((resolve) => {
      if (video.readyState >= 3) { resolve(); return; }
      const done = () => { video.removeEventListener('canplay', done); video.removeEventListener('error', done, true); resolve(); };
      video.addEventListener('canplay', done);
      video.addEventListener('error', done, true);
    }), 0.4);
  }

  add(new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  }), 0.15);

  const total = tasks.reduce((sum, t) => sum + t.weight, 0) || 1;
  return () => tasks.reduce((sum, t) => sum + (t.done ? t.weight : 0), 0) / total;
}

/* ---------- Loader -------------------------------------------------------- */

export function runLoader({ video = null } = {}) {
  const root = document.getElementById('loader');
  let resolveReveal;
  let resolveDone;
  const revealed = new Promise((r) => { resolveReveal = r; });
  const done = new Promise((r) => { resolveDone = r; });

  if (!root) {
    resolveReveal();
    resolveDone();
    return { revealed, done };
  }

  // Le JS prend la main : on neutralise la sécurité CSS (masquage auto si JS cassé)
  root.classList.add('is-js');

  const firstVisit = !store.get(SESSION_KEY, false, 'session');
  const reduced = env.reducedMotion;
  const mode = reduced ? 'reduced' : firstVisit ? 'full' : 'short';
  root.dataset.mode = mode;

  const el = {
    canvas: root.querySelector('.loader__stars'),
    word: root.querySelector('.loader__word'),
    fill: root.querySelector('.loader__word-fill'),
    ship: root.querySelector('.loader__ship'),
    count: root.querySelector('[data-loader-count]'),
    label: root.querySelector('[data-loader-label]'),
    skip: root.querySelector('[data-loader-skip]'),
    status: root.querySelector('[data-loader-status]'),
    flash: root.querySelector('.loader__flash'),
    scene: root.querySelector('.loader__scene'),
    top: root.querySelector('.loader__shutter--top'),
    bottom: root.querySelector('.loader__shutter--bottom'),
  };

  lockScroll('loader');
  setInertOutside(root, true);

  const progressOf = trackLoading(video);
  const minDuration = mode === 'full' ? CONFIG.LOADER.min : CONFIG.LOADER.short * 0.55;
  const maxDuration = mode === 'full' ? CONFIG.LOADER.max : CONFIG.LOADER.short * 1.4;
  const start = performance.now();
  let displayed = 0;
  let exiting = false;
  let skip = false;
  let stars = null;
  // Horloge propre au vaisseau (delta borné) : en cas de saccade pendant le
  // chargement, il ralentit au lieu de « sauter » à travers l'écran.
  const ship = { p: 0, t: -0.25 };
  const SHIP_DURATION = 2.15;
  const easeShip = gsap.parseEase('power1.inOut');

  if (mode === 'full' && el.canvas) {
    stars = new Starfield(el.canvas);
  } else {
    root.classList.add('is-short');
  }

  // Boîte du mot « GJS » mesurée une fois (et au resize) : pas de layout forcé à chaque frame
  let wordBox = null;
  const measure = () => { wordBox = el.word.getBoundingClientRect(); };
  const onResize = () => { if (stars) stars.resize(); measure(); };
  window.addEventListener('resize', onResize);

  // Position du vaisseau : traversée gauche → droite, ondulation sinusoïdale
  const shipPose = (p) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const shipW = el.ship.offsetWidth || 200;
    const x = -shipW * 1.3 + p * (w + shipW * 2.6);
    const amp = Math.min(h * 0.07, 60);
    const y = Math.sin(p * Math.PI * 2.4) * amp;
    const dy = Math.cos(p * Math.PI * 2.4) * amp * Math.PI * 2.4;
    const dx = w + shipW * 2.6;
    const angle = Math.atan2(dy, dx);
    return { x, y, angle, shipW, cy: h / 2 };
  };

  if (mode !== 'full') {
    gsap.set(el.ship, { autoAlpha: 0 });
    el.fill.style.setProperty('--reveal', '130%');
  }

  // Boucle principale du loader (ticker GSAP = même horloge que tout le site)
  const tick = (time, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const elapsed = (performance.now() - start) / 1000;

    if (mode === 'full') {
      if (ship.p < 1) {
        ship.t += Math.min(dt, 1 / 30);
        ship.p = easeShip(clamp(ship.t / SHIP_DURATION, 0, 1));
        if (ship.t >= SHIP_DURATION) ship.p = 1;
      }
      const pose = shipPose(ship.p);
      gsap.set(el.ship, { x: pose.x, y: pose.y, rotation: (pose.angle * 180) / Math.PI });
      // Réacteur : arrière du vaisseau, en coordonnées écran
      const tailX = pose.x + pose.shipW * 0.12;
      const tailY = pose.cy + pose.y;
      if (ship.p > 0 && ship.p < 1 && stars && !exiting) stars.emit(tailX, tailY, pose.angle);
      // Révélation de « GJS » jusqu'à la queue du vaisseau
      if (!wordBox || !wordBox.width) measure();
      const box = wordBox;
      const reveal = box.width ? ((tailX - box.left) / box.width) * 100 : 0;
      el.fill.style.setProperty('--reveal', `${clamp(reveal, -10, 130)}%`);
      if (stars) stars.update(dt, time);
    }

    // Compteur : jamais plus vite que le temps minimal, jamais plus loin que le réel
    const timeP = clamp(elapsed / minDuration, 0, 1);
    const real = progressOf();
    const creep = clamp(elapsed / maxDuration, 0, 0.98);
    const target = Math.min(timeP, Math.max(real, creep));
    displayed += (target - displayed) * damp(9, dt);
    const shown = exiting ? 100 : Math.round(displayed * 100);
    if (el.count) el.count.textContent = String(shown).padStart(3, '0');

    const ready = (timeP >= 1 && real >= 1) || elapsed >= maxDuration || skip;
    const shipDone = mode !== 'full' || ship.p >= 1 || skip;
    if (!exiting && ready && shipDone) exit();
  };

  gsap.ticker.add(tick);

  const cleanup = () => {
    gsap.ticker.remove(tick);
    window.removeEventListener('resize', onResize);
    setInertOutside(root, false);
    unlockScroll('loader');
    store.set(SESSION_KEY, true, 'session');
    root.remove();
    resolveDone();
  };

  function exit() {
    exiting = true;
    if (el.count) el.count.textContent = '100';
    if (el.label) el.label.textContent = 'Prêt au décollage';
    if (el.status) el.status.textContent = 'Chargement terminé. Bienvenue chez GJS.';
    announce('Chargement terminé.');
    ship.p = 1;
    el.fill.style.setProperty('--reveal', '130%');
    if (el.skip) el.skip.disabled = true;

    const tl = gsap.timeline({ onComplete: cleanup });

    if (mode === 'reduced') {
      tl.to(root, { autoAlpha: 0, duration: 0.45, ease: 'power1.out', onStart: resolveReveal });
      return;
    }

    if (mode === 'full') {
      const hold = skip ? 0.05 : 0.35;
      const warp = skip ? 0.3 : 0.6;
      tl.add(() => {}, hold);
      tl.to(stars, { warp: 1, duration: warp, ease: 'power2.in' });
      tl.to(el.word, { scale: 1.18, duration: warp, ease: 'power2.in' }, '<');
      tl.to(el.flash, { opacity: 1, duration: 0.09, ease: 'none' });
      tl.set(el.scene, { autoAlpha: 0 });
      tl.to(el.flash, { opacity: 0, duration: 0.4, ease: 'power2.out' });
      tl.add(resolveReveal, '<');
      tl.to(el.top, { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, '<');
      tl.to(el.bottom, { yPercent: 100, duration: 1.15, ease: 'expo.inOut' }, '<');
      return;
    }

    // Version courte : GJS déjà là, les volets s'ouvrent
    tl.to(el.scene, { autoAlpha: 0, duration: 0.25, ease: 'power1.out' }, 0.05);
    tl.add(resolveReveal, 0.12);
    tl.to(el.top, { yPercent: -100, duration: 0.8, ease: 'expo.inOut' }, 0.12);
    tl.to(el.bottom, { yPercent: 100, duration: 0.8, ease: 'expo.inOut' }, 0.12);
  }

  if (el.skip) {
    el.skip.addEventListener('click', () => {
      skip = true;
      ship.p = 1;
    }, { once: true });
  }

  return { revealed, done };
}
