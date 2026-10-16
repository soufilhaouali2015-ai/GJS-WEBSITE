/* ==========================================================================
   GJS — PAGES LÉGALES (mentions, confidentialité)
   Sommaire collant avec section active surlignée.
   ========================================================================== */

import { $$ } from '../core/utils.js';

const { ScrollTrigger } = window;

export default {
  init(scope, root) {
    const links = $$('.legal__toc a[href^="#"]', root);
    links.forEach((link) => {
      const section = root.querySelector(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 40%',
        end: 'bottom 40%',
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((l) => l.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        },
      });
    });
  },
  destroy() {},
};
