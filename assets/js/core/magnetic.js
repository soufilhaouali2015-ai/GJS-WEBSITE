/* ==========================================================================
   GJS — ÉLÉMENTS MAGNÉTIQUES
   [data-magnetic]              attraction (défaut 0.35)
   [data-magnetic="0.4"]        force personnalisée
   [data-magnetic-radius="120"] rayon d'activation en px autour de l'élément
   [data-magnetic-inner]        enfant qui bouge davantage (effet de profondeur)
   Un seul écouteur global ; refresh() après chaque changement de page.
   ========================================================================== */

import { env } from './utils.js';

const { gsap } = window;

let items = [];
let pointer = { x: -9999, y: -9999 };
let bound = false;
let frame = 0;

function update() {
  frame = 0;
  for (const item of items) {
    const { el, strength, radius, inner } = item;
    // Rectangle sans la translation magnétique courante (évite la rétroaction)
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - item.x;
    const cy = rect.top + rect.height / 2 - item.y;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const reachX = rect.width / 2 + radius;
    const reachY = rect.height / 2 + radius;
    const inside = Math.abs(dx) < reachX && Math.abs(dy) < reachY;
    const tx = inside ? dx * strength : 0;
    const ty = inside ? dy * strength : 0;
    if (tx !== item.tx || ty !== item.ty) {
      item.tx = tx;
      item.ty = ty;
      item.qx(tx);
      item.qy(ty);
      if (inner) { item.ix(tx * 0.5); item.iy(ty * 0.5); }
    }
  }
}

function onMove(e) {
  if (e.pointerType !== 'mouse') return;
  pointer = { x: e.clientX, y: e.clientY };
  if (!frame) frame = requestAnimationFrame(update);
}

const killItem = (item) => {
  [item.qx, item.qy, item.ix, item.iy].forEach((q) => { if (q && q.tween) q.tween.kill(); });
  gsap.set([item.el, item.inner].filter(Boolean), { x: 0, y: 0 });
};

/** Synchronise la liste avec le DOM : garde les éléments persistants (header), oublie les anciens. */
export function refreshMagnetic() {
  if (!env.finePointer || env.reducedMotion) {
    items.forEach(killItem);
    items = [];
    return;
  }

  if (!bound) {
    bound = true;
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', () => { pointer = { x: -9999, y: -9999 }; update(); });
  }

  const current = new Set(document.querySelectorAll('[data-magnetic]'));
  items = items.filter((item) => {
    if (current.has(item.el) && item.el.isConnected) { current.delete(item.el); return true; }
    killItem(item);
    return false;
  });

  current.forEach((el) => {
    const inner = el.querySelector('[data-magnetic-inner]');
    const item = {
      el,
      inner,
      strength: parseFloat(el.dataset.magnetic) || 0.35,
      radius: parseFloat(el.dataset.magneticRadius) || 60,
      tx: 0,
      ty: 0,
      qx: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }),
      qy: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' }),
    };
    Object.defineProperty(item, 'x', { get: () => gsap.getProperty(el, 'x') });
    Object.defineProperty(item, 'y', { get: () => gsap.getProperty(el, 'y') });
    if (inner) {
      item.ix = gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3.out' });
      item.iy = gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3.out' });
    }
    items.push(item);
  });
}
