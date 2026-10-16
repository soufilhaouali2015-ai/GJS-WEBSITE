/* ==========================================================================
   GJS — ACCORDÉONS (<details> natifs, animés)
   Le <details>/<summary> reste la base accessible (clavier, lecteurs d'écran) ;
   le JS n'ajoute qu'une animation de hauteur. Mouvement réduit : natif pur.
   ========================================================================== */

import { env } from './utils.js';

const { gsap } = window;

export function initAccordions(scope, container) {
  container.querySelectorAll('details[data-accordion]').forEach((details) => {
    const summary = details.querySelector('summary');
    const content = details.querySelector('.accordion__content');
    if (!summary || !content) return;
    let anim = null;

    scope.on(summary, 'click', (e) => {
      if (env.reducedMotion) return;
      e.preventDefault();
      if (anim) anim.kill();
      if (!details.open || details.dataset.closing) {
        delete details.dataset.closing;
        details.open = true;
        anim = gsap.fromTo(content, { height: 0, opacity: 0 }, {
          height: 'auto',
          opacity: 1,
          duration: 0.65,
          ease: 'expo.out',
          onComplete: () => gsap.set(content, { clearProps: 'height,opacity' }),
        });
      } else {
        details.dataset.closing = '1';
        anim = gsap.to(content, {
          height: 0,
          opacity: 0,
          duration: 0.45,
          ease: 'power3.inOut',
          onComplete: () => {
            delete details.dataset.closing;
            details.open = false;
            gsap.set(content, { clearProps: 'height,opacity' });
          },
        });
      }
    });
  });
}
