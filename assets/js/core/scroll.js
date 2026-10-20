/* ==========================================================================
   GJS · DÉFILEMENT
   Lenis (défilement fluide) synchronisé sur le ticker GSAP et ScrollTrigger.
   Sur tactile, Lenis laisse le défilement natif du téléphone (syncTouch off).
   En mouvement réduit : défilement natif, sans Lenis.
   ========================================================================== */

import { profile } from './profile.js';

let lenis = null;
let nativeVelocity = 0;
let nativeAt = 0; // instant de la dernière mesure native
const scrollListeners = new Set();

export const getLenis = () => lenis;

/** Vitesse de défilement (px par image environ), signe = sens. */
// Sans Lenis, la vitesse native retombe d'elle-même avec le temps (aucune boucle à faire tourner)
export const scrollVelocity = () => (lenis ? lenis.velocity : nativeVelocity * 0.85 ** ((performance.now() - nativeAt) / 16.7));

/** Sens du dernier défilement : 1 vers le bas, -1 vers le haut. */
let direction = 1;
export const scrollDirection = () => direction;

export function onScroll(cb) {
  scrollListeners.add(cb);
  return () => scrollListeners.delete(cb);
}

function headerOffset() {
  const h = document.querySelector('.header');
  return h ? h.offsetHeight + 16 : 0;
}

export function scrollTo(target, { immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (lenis) {
    lenis.scrollTo(el ?? 0, { offset: el ? -headerOffset() : 0, immediate, duration: 1.2 });
    return;
  }
  const top = el ? el.getBoundingClientRect().top + window.scrollY - headerOffset() : 0;
  window.scrollTo({ top, behavior: immediate || profile === 'reduced' ? 'auto' : 'smooth' });
}

export function initScroll() {
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  let lastY = window.scrollY;
  const emit = () => {
    const y = window.scrollY;
    if (y !== lastY) direction = y > lastY ? 1 : -1;
    if (!lenis) { nativeVelocity = y - lastY; nativeAt = performance.now(); }
    lastY = y;
    scrollListeners.forEach((cb) => cb(y));
  };

  if (profile !== 'reduced' && typeof Lenis === 'function') {
    lenis = new Lenis({
      lerp: 0.11, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, autoRaf: false,
      // Les zones qui défilent elles-mêmes gardent la molette native (message, cookies, menu, tableaux)
      prevent: (node) => node.matches('textarea, .cookies, .menu, .table-wrap, [data-lenis-prevent]'),
    });
    lenis.on('scroll', () => { ScrollTrigger.update(); emit(); });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', emit, { passive: true });
  }

  // Arrivée sur une ancre (ex. services.html#site) : on recale après la mise en page
  if (window.location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    // Une fiche service (<dialog>) s'ouvre par-dessus la page : pas de défilement
    if (target && target.tagName !== 'DIALOG') window.addEventListener('load', () => scrollTo(target, { immediate: true }), { once: true });
  }
}
