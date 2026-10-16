/* ==========================================================================
   GJS — CTA DE FIN DE PAGE
   Le titre suit légèrement le curseur (desktop, mouvement non réduit).
   ========================================================================== */

import { env } from './utils.js';

const { gsap } = window;

export function initCta(scope, container) {
  if (!env.finePointer || env.reducedMotion) return;
  container.querySelectorAll('[data-cta]').forEach((section) => {
    const title = section.querySelector('[data-cta-title]');
    if (!title) return;
    const qx = gsap.quickTo(title, 'x', { duration: 1.2, ease: 'power3.out' });
    const qy = gsap.quickTo(title, 'y', { duration: 1.2, ease: 'power3.out' });
    scope.on(section, 'pointermove', (e) => {
      const r = section.getBoundingClientRect();
      qx(((e.clientX - r.left) / r.width - 0.5) * 60);
      qy(((e.clientY - r.top) / r.height - 0.5) * 36);
    });
    scope.on(section, 'pointerleave', () => { qx(0); qy(0); });
  });
}
