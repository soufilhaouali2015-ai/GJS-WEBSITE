/* ==========================================================================
   GJS · HEADER ET BARRE DE LECTURE
   Le header se cache quand on descend et revient dès qu'on remonte (ou dès
   qu'il reçoit le focus clavier). Barre de progression citron en haut.
   ========================================================================== */

import { onScroll } from './scroll.js';

export function initHeader() {
  const header = document.querySelector('.header');
  const bar = document.querySelector('[data-read-progress]');
  if (!header) return;
  let lastY = window.scrollY;
  let hidden = false;

  const setHidden = (on) => {
    if (on === hidden) return;
    hidden = on;
    header.classList.toggle('is-hidden', on);
  };

  const update = (y = window.scrollY) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    const menuOpen = document.documentElement.classList.contains('is-menu-open');
    const dy = y - lastY;
    if (y < 120 || menuOpen) setHidden(false);
    else if (dy > 6) setHidden(true);
    else if (dy < -6) setHidden(false);
    lastY = y;
  };

  header.addEventListener('focusin', () => setHidden(false));
  onScroll(update);
  update();
}
