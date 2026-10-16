/* ==========================================================================
   GJS — EASTER EGGS
   1. Code Konami (↑↑↓↓←→←→BA) → mode Hyperespace + code promo secret
   2. Taper « gjs » hors champ de saisie → le logo du header fait un tonneau
   3. Message ASCII dans la console
   4. 7 clics sur le « GJS » géant du footer → mini-défi caché (chasse au vaisseau)
   ========================================================================== */

import { CONFIG } from './config.js';
import { env, isTypingTarget, createShip, rand, announce, trapFocus } from './core/utils.js';
import { lockScroll, unlockScroll } from './core/scroll.js';

const { gsap } = window;

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let hyperspaceRunning = false;

/* ---------- 3. Console -------------------------------------------------- */

function consoleMessage() {
  const art = [
    '  ██████╗      ██╗███████╗',
    ' ██╔════╝      ██║██╔════╝',
    ' ██║  ███╗     ██║███████╗',
    ' ██║   ██║██   ██║╚════██║',
    ' ╚██████╔╝╚█████╔╝███████║',
    '  ╚═════╝  ╚════╝ ╚══════╝',
  ].join('\n');
  /* eslint-disable no-console */
  console.log(`%c${art}`, 'color:#5B85FF;font-family:monospace;font-size:11px;line-height:1.1;text-shadow:0 0 8px rgba(91,133,255,.6)');
  console.log(
    `%cVous lisez notre code ?%c Écrivez-nous : ${CONFIG.EMAIL}\n%c(Indice : les vieux codes de console marchent encore ici. ↑↑↓↓…)`,
    'color:#fff;background:#060B1E;padding:4px 8px;font-weight:600',
    'color:#5B85FF;background:#060B1E;padding:4px 8px',
    'color:#8a93b3;font-style:italic',
  );
  /* eslint-enable no-console */
}

/* ---------- 2. Tonneau du logo ------------------------------------------- */

function barrelRoll() {
  const logo = document.querySelector('.header__logo-inner');
  if (!logo || gsap.isTweening(logo)) return;
  document.querySelector('[data-header]')?.classList.remove('is-hidden');
  announce('Tonneau !');
  if (env.reducedMotion) {
    gsap.fromTo(logo, { opacity: 0.2 }, { opacity: 1, duration: 0.6 });
    return;
  }
  // Traînée : copies fantômes qui suivent la rotation avec retard
  const ghosts = [];
  for (let i = 1; i <= 4; i += 1) {
    const ghost = logo.cloneNode(true);
    ghost.classList.add('header__logo-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    logo.parentNode.insertBefore(ghost, logo);
    ghosts.push(ghost);
  }
  const roll = (target, delay, opacity) => gsap.timeline({ delay })
    .set(target, { opacity })
    .to(target, { keyframes: { y: [0, -14, 0], rotation: [0, 180, 360], scale: [1, 1.25, 1] }, duration: 0.9, ease: 'power2.inOut' })
    .to(target, { opacity: target === logo ? 1 : 0, duration: 0.2 }, '-=0.2');
  roll(logo, 0, 1);
  ghosts.forEach((g, i) => roll(g, (i + 1) * 0.045, 0.5 - i * 0.1).eventCallback('onComplete', () => g.remove()));
}

/* ---------- 1. Hyperespace ----------------------------------------------- */

function warpCanvas(duration) {
  const canvas = document.createElement('canvas');
  canvas.className = 'egg-warp';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const stars = Array.from({ length: 420 }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.05, 1) }));
  const state = { speed: 0 };
  gsap.timeline()
    .to(state, { speed: 1.6, duration: duration * 0.35, ease: 'power2.in' })
    .to(state, { speed: 0, duration: duration * 0.4, ease: 'power2.out' }, duration * 0.6);
  const tick = (t, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = 'rgba(3,6,15,0.35)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    for (const s of stars) {
      const pz = s.z;
      s.z -= state.speed * dt;
      if (s.z <= 0.02) { s.x = rand(-1, 1); s.y = rand(-1, 1); s.z = 1; continue; }
      const sx = w / 2 + (s.x / s.z) * w * 0.5;
      const sy = h / 2 + (s.y / s.z) * h * 0.5;
      const px = w / 2 + (s.x / pz) * w * 0.5;
      const py = h / 2 + (s.y / pz) * h * 0.5;
      ctx.lineWidth = (1 - s.z) * 2.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  };
  gsap.ticker.add(tick);
  window.addEventListener('resize', resize);
  gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 0.6 });
  return () => {
    gsap.to(canvas, {
      opacity: 0, duration: 0.6, onComplete: () => {
        gsap.ticker.remove(tick);
        window.removeEventListener('resize', resize);
        canvas.remove();
      },
    });
  };
}

function flyShipAcross() {
  const ship = createShip('egg-ship');
  document.body.appendChild(ship);
  const w = window.innerWidth;
  const h = window.innerHeight;
  gsap.set(ship, { x: -260, y: h * 0.75, rotation: -14 });
  return gsap.timeline({ onComplete: () => ship.remove() })
    .to(ship, { x: w * 0.45, y: h * 0.38, rotation: -10, duration: 1.4, ease: 'power2.out' })
    .to(ship, { x: w + 300, y: h * 0.12, rotation: -18, scale: 0.6, duration: 0.9, ease: 'power3.in' });
}

function secretModal() {
  const dialog = document.createElement('dialog');
  dialog.className = 'egg-modal';
  dialog.setAttribute('aria-labelledby', 'egg-title');
  dialog.innerHTML = `
    <p class="label label--signal">[ ACCÈS DÉVERROUILLÉ ] — MODE HYPERESPACE</p>
    <h2 class="egg-modal__title t-display" id="egg-title">Vous avez <em class="serif">trouvé</em> la porte dérobée.</h2>
    <p class="egg-modal__text">-10 % sur votre premier audit. Mentionnez ce code dans votre message :</p>
    <p class="egg-modal__code"><code>${CONFIG.PROMO_CODE}</code></p>
    <div class="egg-modal__actions">
      <button type="button" class="btn btn--light" data-egg-copy>Copier le code</button>
      <a class="btn btn--ghost" href="contact.html?code=${encodeURIComponent(CONFIG.PROMO_CODE)}" data-egg-close-nav>L'utiliser maintenant →</a>
      <button type="button" class="egg-modal__close label" data-egg-close>Fermer [Échap]</button>
    </div>
    <p class="sr-only" aria-live="polite" data-egg-feedback></p>`;
  document.body.appendChild(dialog);
  lockScroll('egg');
  dialog.showModal();
  const release = trapFocus(dialog, { restore: true });
  if (!env.reducedMotion) {
    gsap.from(dialog.children, { y: 30, autoAlpha: 0, stagger: 0.07, duration: 0.8, ease: 'expo.out' });
  }
  const close = () => {
    release();
    unlockScroll('egg');
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-egg-close]') || e.target === dialog) close();
    if (e.target.closest('[data-egg-close-nav]')) close();
    if (e.target.closest('[data-egg-copy]')) {
      const btn = e.target.closest('[data-egg-copy]');
      const done = () => {
        btn.textContent = 'Copié ✓';
        dialog.querySelector('[data-egg-feedback]').textContent = 'Code copié dans le presse-papiers.';
      };
      if (navigator.clipboard) navigator.clipboard.writeText(CONFIG.PROMO_CODE).then(done, () => { btn.textContent = CONFIG.PROMO_CODE; });
      else btn.textContent = CONFIG.PROMO_CODE;
    }
  });
}

function hyperspace() {
  if (hyperspaceRunning || document.querySelector('.arcade, .egg-modal')) return;
  hyperspaceRunning = true;
  announce('Code Konami détecté. Passage en hyperespace.', 'assertive');
  if (env.reducedMotion) {
    secretModal();
    hyperspaceRunning = false;
    return;
  }
  const DURATION = 5;
  const html = document.documentElement;
  const stopWarp = warpCanvas(DURATION);
  html.classList.add('is-hyperspace');
  flyShipAcross();
  gsap.delayedCall(DURATION, () => {
    stopWarp();
    html.classList.remove('is-hyperspace');
    hyperspaceRunning = false;
    secretModal();
  });
}

/* ---------- Écoute clavier ------------------------------------------------ */

export function initEasterEggs() {
  consoleMessage();
  let konami = 0;
  let typed = '';
  let typedTimer = 0;

  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('.arcade')) return; // les flèches servent aux jeux
    const key = e.key.toLowerCase();

    konami = key === KONAMI[konami] ? konami + 1 : (key === KONAMI[0] ? 1 : 0);
    if (konami === KONAMI.length) {
      konami = 0;
      hyperspace();
      return;
    }

    if (key.length === 1) {
      typed = (typed + key).slice(-3);
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => { typed = ''; }, 1500);
      if (typed === 'gjs') { typed = ''; barrelRoll(); }
    }
  });

  document.addEventListener('gjs:egg-footer', async () => {
    const { startShipHunt } = await import('./games/ship-hunt.js');
    startShipHunt();
  });
}
