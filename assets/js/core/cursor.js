/* ==========================================================================
   GJS — CURSEUR CUSTOM (desktop, pointer: fine uniquement)
   Point 8 px + cercle 40 px en mix-blend-mode: difference, suivi lerp.
   États par délégation (aucun rebind entre pages) :
     liens / boutons            → le cercle grossit
     [data-cursor="view"]       → pastille « VOIR »
     [data-cursor="play"]       → pastille « PLAY » (ou data-cursor-label)
     [data-cursor="drag"]       → pastille « DRAG »
     [data-cursor="game"]       → réticule
     champs de saisie           → curseur natif (custom masqué)
   ========================================================================== */

import { env, damp } from './utils.js';

const { gsap } = window;

const LABELS = { view: 'Voir', play: 'Play', drag: 'Drag', close: 'Fermer' };
const INTERACTIVE = 'a, button, [role="button"], summary, label, [data-cursor]';
const TEXT_INPUT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, select';

let root = null;

export function initCursor() {
  if (!env.finePointer || root) return;

  root = document.createElement('div');
  root.className = 'cursor';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span><span class="cursor__reticle"></span></div><div class="cursor__dot"></div>';
  document.body.appendChild(root);
  document.documentElement.classList.add('has-cursor');

  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');
  const label = root.querySelector('.cursor__label');

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringPos = { ...pos };
  const dotPos = { ...pos };
  let visible = false;
  let state = '';

  gsap.set([ring, dot], { xPercent: -50, yPercent: -50 });
  const setRingX = gsap.quickSetter(ring, 'x', 'px');
  const setRingY = gsap.quickSetter(ring, 'y', 'px');
  const setDotX = gsap.quickSetter(dot, 'x', 'px');
  const setDotY = gsap.quickSetter(dot, 'y', 'px');

  const setState = (next, text = '') => {
    if (next === state && label.textContent === text) return;
    state = next;
    root.dataset.state = next;
    label.textContent = text;
  };

  const resolve = (target) => {
    if (!(target instanceof Element)) { setState(''); return; }
    if (target.closest(TEXT_INPUT)) { setState('hidden'); return; }
    const custom = target.closest('[data-cursor]');
    if (custom) {
      const kind = custom.dataset.cursor;
      setState(kind, custom.dataset.cursorLabel || LABELS[kind] || '');
      return;
    }
    if (target.closest(INTERACTIVE)) { setState('hover'); return; }
    setState('');
  };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pos.x = e.clientX;
    pos.y = e.clientY;
    if (!visible) {
      visible = true;
      ringPos.x = dotPos.x = pos.x;
      ringPos.y = dotPos.y = pos.y;
      root.classList.add('is-visible');
    }
  }, { passive: true });

  document.addEventListener('pointerover', (e) => resolve(e.target), { passive: true });
  document.addEventListener('pointerdown', () => root.classList.add('is-pressed'), { passive: true });
  document.addEventListener('pointerup', () => root.classList.remove('is-pressed'), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { visible = false; root.classList.remove('is-visible'); });
  // Un libellé dynamique (ex. PLAY ↔ PAUSE) peut changer sous le curseur
  document.addEventListener('gjs:cursor-refresh', () => {
    const el = document.elementFromPoint(pos.x, pos.y);
    state = '__';
    resolve(el);
  });

  gsap.ticker.add((time, deltaMs) => {
    if (!visible) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const instant = env.reducedMotion;
    const kRing = instant ? 1 : damp(14, dt);
    const kDot = instant ? 1 : damp(40, dt);
    ringPos.x += (pos.x - ringPos.x) * kRing;
    ringPos.y += (pos.y - ringPos.y) * kRing;
    dotPos.x += (pos.x - dotPos.x) * kDot;
    dotPos.y += (pos.y - dotPos.y) * kDot;
    setRingX(ringPos.x);
    setRingY(ringPos.y);
    setDotX(dotPos.x);
    setDotY(dotPos.y);
  });
}

/** Force la réévaluation de l'état (après un changement de libellé). */
export function refreshCursor() {
  document.dispatchEvent(new CustomEvent('gjs:cursor-refresh'));
}
