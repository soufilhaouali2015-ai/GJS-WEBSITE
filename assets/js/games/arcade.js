/* ==========================================================================
   GJS ARCADE — COQUE COMMUNE DES MINI-JEUX
   Modale plein écran (CRT, scanlines) : écran titre → règles → 3-2-1 →
   partie → pause (Échap / P) → écran de fin (score, record, conversion, CTA).
   Scroll Lenis stoppé pendant le jeu, boucles détruites à la fermeture,
   focus piégé et restitué, reste de la page inerte.

   Contrat d'un jeu (module avec export create(api)) :
     create(api) → { start(), pause(), resume(), destroy() }
     api.stage   élément où monter le jeu
     api.hud(html), api.live(msg), api.end(result), api.sound, api.touch
     result = { won, title, detail, score, scoreLabel, isRecord, message, cta: { label, href } }
   ========================================================================== */

import { lockScroll, unlockScroll } from '../core/scroll.js';
import { trapFocus, setInertOutside, announce, env } from '../core/utils.js';
import { sound, getBest, prefersTouch } from './utils.js';

const { gsap } = window;

export const GAMES = {
  button: {
    num: '01',
    title: 'Quelle est la meilleure agence digitale ?',
    rules: ['Une question, deux réponses. Cliquez sur la bonne.', 'Indice : l’autre bouton est un peu timide.'],
    load: () => import('./button-game.js'),
  },
  race: {
    num: '02',
    title: 'Bad Practices Highway',
    rules: ['← → (A / D, Q / D en AZERTY) pour changer de voie. Sur mobile : boutons ou balayage.', 'Évitez les mauvaises pratiques. Les bonnes rapportent des points et un bouclier de 3 s.'],
    load: () => import('./race-game.js'),
  },
  maze: {
    num: '03',
    title: 'Lead Rush',
    rules: ['Flèches, ZQSD ou WASD. Sur mobile : balayez ou utilisez le pad.', 'Collectez les leads, survivez 60 s. Un « Agent IA » rend les ennemis capturables pendant 6 s.'],
    load: () => import('./maze-game.js'),
  },
};

let session = null;

export function ensureStyles() {
  if (document.querySelector('link[data-games-css]')) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../css/games.css', import.meta.url).href;
    link.dataset.gamesCss = '';
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

function template(id, def) {
  return `
    <div class="arcade__crt" aria-hidden="true"></div>
    <header class="arcade__bar">
      <p class="arcade__brand t-mono"><span class="dot-live" aria-hidden="true"></span> GJS Arcade — Jeu ${def.num}</p>
      <div class="arcade__hud t-mono" data-hud></div>
      <div class="arcade__tools">
        <button class="arcade__tool t-mono" type="button" data-arcade-sound aria-pressed="false">Son : off</button>
        <button class="arcade__tool t-mono" type="button" data-arcade-pause hidden>Pause [P]</button>
        <button class="arcade__tool t-mono" type="button" data-arcade-close>Quitter [Échap]</button>
      </div>
    </header>
    <div class="arcade__stage arcade__stage--${id}" data-stage data-cursor="game" tabindex="-1"></div>
    <div class="arcade__screen" data-screen></div>
    <p class="sr-only" aria-live="polite" data-arcade-live></p>
    <p class="sr-only" aria-live="assertive" data-arcade-alert></p>`;
}

function bestLabel(id) {
  const best = getBest(id);
  return best ? best.label || String(best.score) : 'aucun — à vous de jouer';
}

export async function openGame(id, opener) {
  const def = GAMES[id];
  if (!def || session) return;
  await ensureStyles();

  const root = document.createElement('div');
  root.className = `arcade arcade--${id}`;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `GJS Arcade — ${def.title}`);
  root.dataset.lenisPrevent = '';
  root.innerHTML = template(id, def);
  document.body.appendChild(root);

  const el = {
    stage: root.querySelector('[data-stage]'),
    screen: root.querySelector('[data-screen]'),
    hud: root.querySelector('[data-hud]'),
    live: root.querySelector('[data-arcade-live]'),
    alert: root.querySelector('[data-arcade-alert]'),
    sound: root.querySelector('[data-arcade-sound]'),
    pause: root.querySelector('[data-arcade-pause]'),
    close: root.querySelector('[data-arcade-close]'),
  };

  const state = { id, def, root, el, mode: 'title', game: null, module: null, opener, release: null, timers: [] };
  session = state;

  lockScroll('arcade');
  setInertOutside(root, true);
  document.documentElement.classList.add('is-arcade-open');
  sound.restore();
  syncSound(state);

  if (!env.reducedMotion) gsap.fromTo(root, { clipPath: 'inset(50% 0% 50% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'expo.inOut' });

  el.sound.addEventListener('click', () => { sound.toggle(); syncSound(state); });
  el.pause.addEventListener('click', () => togglePause(state));
  el.close.addEventListener('click', () => closeGame());
  root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;
    const a = action.dataset.action;
    if (a === 'start' || a === 'replay') startCountdown(state);
    if (a === 'resume') togglePause(state);
    if (a === 'quit') closeGame();
    if (a === 'cta') closeGame({ restoreFocus: false });
  });
  state.onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.mode === 'playing') togglePause(state);
      else closeGame();
    } else if ((e.key === 'p' || e.key === 'P') && (state.mode === 'playing' || state.mode === 'paused')) {
      e.preventDefault();
      togglePause(state);
    }
  };
  window.addEventListener('keydown', state.onKey, true);
  state.onVisibility = () => { if (document.hidden && state.mode === 'playing') togglePause(state); };
  document.addEventListener('visibilitychange', state.onVisibility);
  state.onLeave = () => closeGame({ immediate: true, restoreFocus: false });
  document.addEventListener('gjs:before-leave', state.onLeave);

  state.module = await def.load();
  showTitle(state);
  state.release = trapFocus(root, { initial: root.querySelector('[data-action="start"]') });
  announce(`Jeu ouvert : ${def.title}.`);
}

function syncSound(state) {
  state.el.sound.textContent = sound.enabled ? 'Son : on' : 'Son : off';
  state.el.sound.setAttribute('aria-pressed', String(sound.enabled));
}

function setScreen(state, html, { focus } = {}) {
  const { screen } = state.el;
  screen.innerHTML = html;
  screen.hidden = !html;
  if (html && !env.reducedMotion) gsap.from(screen.querySelectorAll('.arcade-screen > *'), { y: 24, autoAlpha: 0, stagger: 0.06, duration: 0.6, ease: 'expo.out' });
  if (focus) {
    const target = screen.querySelector(focus);
    if (target) requestAnimationFrame(() => target.focus());
  }
}

function showTitle(state) {
  const { def, id } = state;
  state.mode = 'title';
  state.el.pause.hidden = true;
  setScreen(state, `
    <div class="arcade-screen arcade-screen--title">
      <p class="label label--signal">Jeu ${def.num} / 03 — Insert coin</p>
      <h2 class="arcade-screen__title t-display">${def.title}</h2>
      <ol class="arcade-screen__rules">${def.rules.map((r) => `<li>${r}</li>`).join('')}</ol>
      <p class="arcade-screen__best t-mono">Record : ${bestLabel(id)}</p>
      <div class="arcade-screen__actions">
        <button class="btn btn--light" type="button" data-action="start">Jouer <span class="btn__arrow" aria-hidden="true">→</span></button>
        <button class="btn btn--ghost" type="button" data-action="quit">Quitter</button>
      </div>
      <p class="arcade-screen__hint t-mono">Échap / P : pause — son désactivé par défaut</p>
    </div>`);
}

function createGame(state) {
  if (state.game) { state.game.destroy(); state.game = null; }
  state.el.stage.innerHTML = '';
  state.el.hud.innerHTML = '';
  const api = {
    stage: state.el.stage,
    sound,
    touch: prefersTouch(),
    reduced: env.reducedMotion,
    hud: (html) => { state.el.hud.innerHTML = html; },
    live: (msg) => { state.el.live.textContent = msg; },
    alert: (msg) => { state.el.alert.textContent = ''; setTimeout(() => { state.el.alert.textContent = msg; }, 40); },
    end: (result) => showEnd(state, result),
  };
  state.game = state.module.create(api);
}

function startCountdown(state) {
  state.timers.forEach(clearTimeout);
  state.timers = [];
  createGame(state);
  state.mode = 'countdown';
  state.el.pause.hidden = true;
  const steps = ['3', '2', '1', 'GO'];
  const show = (i) => {
    if (i >= steps.length) {
      setScreen(state, '');
      state.mode = 'playing';
      state.el.pause.hidden = false;
      state.el.stage.focus({ preventScroll: true });
      state.game.start();
      return;
    }
    setScreen(state, `<div class="arcade-screen arcade-screen--count"><p class="arcade-count" aria-hidden="true">${steps[i]}</p></div>`);
    state.el.live.textContent = steps[i] === 'GO' ? 'Partez !' : steps[i];
    if (steps[i] === 'GO') sound.go(); else sound.count();
    if (!env.reducedMotion) gsap.fromTo(state.el.screen.querySelector('.arcade-count'), { scale: 1.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'expo.out' });
    state.timers.push(setTimeout(() => show(i + 1), i === steps.length - 1 ? 420 : 650));
  };
  show(0);
}

function togglePause(state) {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    state.game.pause();
    state.el.pause.textContent = 'Reprendre [P]';
    setScreen(state, `
      <div class="arcade-screen arcade-screen--pause">
        <p class="label label--signal">Pause</p>
        <h2 class="arcade-screen__title t-display">On souffle. <em class="serif">Deux secondes.</em></h2>
        <div class="arcade-screen__actions">
          <button class="btn btn--light" type="button" data-action="resume">Reprendre</button>
          <button class="btn btn--ghost" type="button" data-action="replay">Recommencer</button>
          <button class="btn btn--ghost" type="button" data-action="quit">Quitter</button>
        </div>
      </div>`, { focus: '[data-action="resume"]' });
    state.el.live.textContent = 'Jeu en pause.';
  } else if (state.mode === 'paused') {
    setScreen(state, '');
    state.mode = 'playing';
    state.el.pause.textContent = 'Pause [P]';
    state.el.stage.focus({ preventScroll: true });
    state.game.resume();
    state.el.live.textContent = 'Reprise.';
  }
}

function showEnd(state, result) {
  state.mode = 'over';
  state.el.pause.hidden = true;
  const cta = result.cta || { label: 'Parlons de votre projet', href: 'contact.html' };
  setScreen(state, `
    <div class="arcade-screen arcade-screen--end ${result.won ? 'is-won' : 'is-lost'}">
      <p class="label label--signal">${result.won ? 'Mission accomplie' : 'Game over'}${result.isRecord ? ' — Nouveau record !' : ''}</p>
      <h2 class="arcade-screen__title t-display">${result.title}</h2>
      ${result.detail ? `<p class="arcade-screen__detail">${result.detail}</p>` : ''}
      <p class="arcade-screen__score t-mono">${result.scoreLabel || `Score : ${result.score}`} — Record : ${bestLabel(state.id)}</p>
      <p class="arcade-screen__message">${result.message || 'GJS vous évite ça.'}</p>
      <div class="arcade-screen__actions">
        <a class="btn btn--light" href="${cta.href}" data-action="cta">${cta.label} <span class="btn__arrow" aria-hidden="true">→</span></a>
        <button class="btn btn--ghost" type="button" data-action="replay">Rejouer</button>
        <button class="btn btn--ghost" type="button" data-action="quit">Quitter</button>
      </div>
    </div>`, { focus: '[data-action="replay"]' });
  state.el.alert.textContent = `${result.won ? 'Gagné' : 'Perdu'}. ${result.title.replace(/<[^>]+>/g, '')} ${result.scoreLabel || ''}`;
}

export function closeGame({ immediate = false, restoreFocus = true } = {}) {
  const state = session;
  if (!state) return;
  session = null;
  state.timers.forEach(clearTimeout);
  if (state.game) state.game.destroy();
  window.removeEventListener('keydown', state.onKey, true);
  document.removeEventListener('visibilitychange', state.onVisibility);
  document.removeEventListener('gjs:before-leave', state.onLeave);
  if (state.release) state.release();
  setInertOutside(state.root, false);
  unlockScroll('arcade');
  document.documentElement.classList.remove('is-arcade-open');
  const done = () => {
    state.root.remove();
    if (restoreFocus && state.opener && document.contains(state.opener)) state.opener.focus({ preventScroll: true });
  };
  if (immediate || env.reducedMotion) done();
  else gsap.to(state.root, { clipPath: 'inset(50% 0% 50% 0%)', duration: 0.5, ease: 'expo.inOut', onComplete: done });
  announce('Jeu fermé.');
}
