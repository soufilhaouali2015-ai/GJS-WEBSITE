/* ==========================================================================
   GJS — SCROLL
   Lenis synchronisé sur le ticker GSAP + ScrollTrigger.
   Verrous nommés (loader, menu, modale, jeu…) : le scroll ne reprend que
   lorsque plus aucun verrou n'est actif.
   En prefers-reduced-motion, Lenis n'est pas instancié (scroll natif).
   ========================================================================== */

import { env } from './utils.js';

const { gsap, ScrollTrigger } = window;

let lenis = null;
const locks = new Set();
const listeners = new Set();

// Vélocité/direction en scroll natif (mode réduit) pour les marquees.
let nativeY = 0;
let nativeVelocity = 0;
let nativeDirection = 1;

function emit() {
  listeners.forEach((fn) => fn(getScroll()));
}

export function initScroll() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (!env.reducedMotion && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({
      lerp: 0.095,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
      anchors: false,
      autoResize: true,
      prevent: (node) => Boolean(node.closest && node.closest('[data-lenis-prevent], .arcade, .menu, dialog')),
    });
    lenis.on('scroll', () => {
      ScrollTrigger.update();
      emit();
    });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    nativeY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      nativeVelocity = y - nativeY;
      nativeDirection = nativeVelocity >= 0 ? 1 : -1;
      nativeY = y;
      emit();
    }, { passive: true });
    // Décroissance de la vélocité native quand l'utilisateur s'arrête
    gsap.ticker.add(() => { nativeVelocity *= 0.85; });
  }
}

export const getLenis = () => lenis;

export function getScroll() {
  return lenis ? lenis.scroll : window.scrollY;
}

/** Vélocité en px/frame (≈ ±0 → ±80). */
export function getVelocity() {
  return lenis ? lenis.velocity : nativeVelocity;
}

export function getDirection() {
  return lenis ? (lenis.direction || 1) : nativeDirection;
}

export function onScroll(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyLocks() {
  const locked = locks.size > 0;
  document.documentElement.classList.toggle('is-scroll-locked', locked);
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
}

export function lockScroll(key) {
  locks.add(key);
  applyLocks();
}

export function unlockScroll(key) {
  locks.delete(key);
  applyLocks();
}

export const isLocked = () => locks.size > 0;

/**
 * Défilement programmatique. target : nombre, sélecteur ou élément.
 * immediate : sans animation (changement de page, remise à zéro).
 */
export function scrollTo(target, { offset = 0, immediate = false, duration = 1.4 } = {}) {
  if (lenis) {
    lenis.scrollTo(target, {
      offset,
      immediate,
      duration,
      force: true,
      easing: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
    });
    return;
  }
  let y = 0;
  if (typeof target === 'number') y = target;
  else {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    y = el.getBoundingClientRect().top + window.scrollY;
  }
  window.scrollTo({ top: y + offset, behavior: immediate || env.reducedMotion ? 'auto' : 'smooth' });
}

/** À appeler après l'injection d'une nouvelle page. */
export function resetScroll() {
  if (lenis) {
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.resize();
  }
  window.scrollTo(0, 0);
}

export function resizeScroll() {
  if (lenis) lenis.resize();
}
