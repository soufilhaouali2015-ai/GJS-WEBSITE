/* ==========================================================================
   GJS · APPARITION DES BLOCS
   Une seule animation sur tout le site : fondu + léger glissement (0,4 s, CSS),
   déclenchée une fois quand le bloc entre dans l'écran.
   La classe .has-reveal est posée dans le <head> uniquement si le mouvement
   est autorisé ; sans JS ou en mouvement réduit, tout est visible d'emblée.
   ========================================================================== */

import { $$ } from './utils.js';

export function initReveal() {
  const root = document.documentElement;
  if (!root.classList.contains('has-reveal')) return;
  const items = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    root.classList.remove('has-reveal');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
}
