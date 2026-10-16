/* ==========================================================================
   GJS — MINI-DÉFI CACHÉ (easter egg n° 4, 7 clics sur le « GJS » du footer)
   Cliquez le vaisseau qui traverse l'écran 5 fois en 10 secondes.
   ========================================================================== */

import { ensureStyles } from './arcade.js';
import { getBest, saveBest, sound } from './utils.js';
import { lockScroll, unlockScroll } from '../core/scroll.js';
import { env, rand, announce, trapFocus, formatNumber } from '../core/utils.js';

const { gsap } = window;
const GOAL = 5;
const TIME = 10;

export async function startShipHunt() {
  if (document.querySelector('.hunt, .arcade')) return;
  await ensureStyles();
  const tpl = document.getElementById('tpl-ship');

  const root = document.createElement('div');
  root.className = 'hunt';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Défi caché : la chasse au vaisseau');
  root.innerHTML = `
    <div class="hunt__hud t-mono">
      <p class="label label--signal">[ Défi caché débloqué ]</p>
      <p class="hunt__goal">Touchez le vaisseau ${GOAL} fois en ${TIME} s</p>
      <p class="hunt__stats"><span data-hits>0</span> / ${GOAL} — <span data-time>${TIME.toFixed(1)}</span> s</p>
      <button class="arcade__tool t-mono" type="button" data-hunt-close>Quitter [Échap]</button>
    </div>
    <button class="hunt__ship" type="button" data-cursor="game" aria-label="Vaisseau en fuite : appuyez pour le toucher"></button>
    <div class="hunt__result" data-result hidden></div>
    <p class="sr-only" aria-live="polite" data-hunt-live></p>`;
  root.querySelector('.hunt__ship').appendChild(tpl.content.firstElementChild.cloneNode(true));
  document.body.appendChild(root);

  const shipBtn = root.querySelector('.hunt__ship');
  const hitsEl = root.querySelector('[data-hits]');
  const timeEl = root.querySelector('[data-time]');
  const result = root.querySelector('[data-result]');
  const live = root.querySelector('[data-hunt-live]');
  let hits = 0;
  let left = TIME;
  let running = true;
  let pass = null;
  lockScroll('hunt');
  const release = trapFocus(root, { initial: shipBtn });

  const fly = () => {
    if (!running) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const fromLeft = Math.random() < 0.5;
    const y0 = rand(0.18, 0.82) * h;
    const y1 = rand(0.18, 0.82) * h;
    const size = shipBtn.offsetWidth || 140;
    const pos = { p: 0 };
    const duration = env.reducedMotion ? 3.2 : rand(1.3, 2.1) * (1 - hits * 0.06);
    gsap.set(shipBtn, { scaleX: fromLeft ? 1 : -1, autoAlpha: 1 });
    pass = gsap.to(pos, {
      p: 1,
      duration,
      ease: 'none',
      onUpdate: () => {
        const x = fromLeft ? -size + pos.p * (w + size * 2) : w + size - pos.p * (w + size * 2);
        const y = y0 + (y1 - y0) * pos.p + (env.reducedMotion ? 0 : Math.sin(pos.p * Math.PI * 3) * 40);
        gsap.set(shipBtn, { x, y });
      },
      onComplete: fly,
    });
  };

  const end = (won) => {
    running = false;
    if (pass) pass.kill();
    gsap.to(shipBtn, { autoAlpha: 0, duration: 0.3 });
    const used = TIME - left;
    let isRecord = false;
    if (won) isRecord = saveBest('hunt', used, `${formatNumber(used, 1)} s`, (a, b) => a < b);
    const best = getBest('hunt');
    result.hidden = false;
    result.innerHTML = won ? `
      <p class="label label--signal">${isRecord ? 'Nouveau record' : 'Défi réussi'}</p>
      <h2 class="t-display">${GOAL} / ${GOAL} en ${formatNumber(used, 1)} s. <em class="serif">Œil de lynx.</em></h2>
      <p>Vous repérez les opportunités au vol. Nous, on les transforme en clients.</p>
      <p class="t-mono t-muted">Record : ${best ? best.label : '—'}</p>
      <div class="arcade-screen__actions"><a class="btn btn--light" href="contact.html" data-hunt-cta>Transformer l’essai <span class="btn__arrow" aria-hidden="true">→</span></a><button class="btn btn--ghost" type="button" data-hunt-replay>Rejouer</button></div>` : `
      <p class="label label--signal">Temps écoulé</p>
      <h2 class="t-display">${hits} / ${GOAL}. <em class="serif">Il était plus rapide.</em></h2>
      <p>Les opportunités passent vite. Mieux vaut avoir les bons outils pour les capter.</p>
      <div class="arcade-screen__actions"><button class="btn btn--light" type="button" data-hunt-replay>Rejouer</button><button class="btn btn--ghost" type="button" data-hunt-close>Quitter</button></div>`;
    if (won) sound.win(); else sound.hit();
    if (!env.reducedMotion) gsap.from(result.children, { y: 24, autoAlpha: 0, stagger: 0.07, duration: 0.7, ease: 'expo.out' });
    announce(won ? `Défi réussi en ${formatNumber(used, 1)} secondes.` : `Temps écoulé : ${hits} sur ${GOAL}.`, 'assertive');
    requestAnimationFrame(() => result.querySelector('a, button')?.focus());
  };

  const tick = (t, deltaMs) => {
    if (!running) return;
    left = Math.max(0, left - deltaMs / 1000);
    timeEl.textContent = left.toFixed(1);
    if (left <= 0) end(false);
  };
  gsap.ticker.add(tick);

  const hit = (e) => {
    if (!running) return;
    e.preventDefault();
    hits += 1;
    hitsEl.textContent = String(hits);
    sound.coin();
    live.textContent = `Touché : ${hits} sur ${GOAL}.`;
    // Étincelles DOM au point d'impact
    const rect = shipBtn.getBoundingClientRect();
    for (let i = 0; i < 14; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'hunt__spark';
      root.appendChild(spark);
      const a = Math.random() * Math.PI * 2;
      gsap.set(spark, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      gsap.to(spark, { x: `+=${Math.cos(a) * rand(40, 120)}`, y: `+=${Math.sin(a) * rand(40, 120)}`, autoAlpha: 0, duration: 0.7, ease: 'power3.out', onComplete: () => spark.remove() });
    }
    if (hits >= GOAL) { end(true); return; }
    if (pass) pass.kill();
    fly();
  };

  const close = () => {
    running = false;
    if (pass) pass.kill();
    gsap.ticker.remove(tick);
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('gjs:before-leave', close);
    release();
    unlockScroll('hunt');
    root.remove();
  };

  const replay = () => {
    hits = 0;
    left = TIME;
    running = true;
    hitsEl.textContent = '0';
    result.hidden = true;
    result.innerHTML = '';
    shipBtn.focus();
    fly();
  };

  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('gjs:before-leave', close);
  shipBtn.addEventListener('pointerdown', hit);
  shipBtn.addEventListener('click', (e) => { if (e.detail === 0) hit(e); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-hunt-close]')) close();
    if (e.target.closest('[data-hunt-replay]')) replay();
    if (e.target.closest('[data-hunt-cta]')) close();
  });

  announce('Défi caché débloqué : touchez le vaisseau cinq fois en dix secondes.', 'assertive');
  if (!env.reducedMotion) gsap.from(root.querySelector('.hunt__hud').children, { y: -20, autoAlpha: 0, stagger: 0.06, duration: 0.6, ease: 'expo.out' });
  fly();
}
