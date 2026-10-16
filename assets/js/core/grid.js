/* ==========================================================================
   GJS — OVERLAY DE GRILLE (touche G, desktop) — clin d'œil studio
   ========================================================================== */

import { isTypingTarget, announce } from './utils.js';

export function initGridOverlay() {
  let overlay = null;

  const build = () => {
    overlay = document.createElement('div');
    overlay.className = 'grid-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    for (let i = 1; i <= 12; i += 1) {
      const col = document.createElement('span');
      col.dataset.col = String(i).padStart(2, '0');
      overlay.appendChild(col);
    }
    const info = document.createElement('p');
    info.className = 'grid-overlay__info';
    info.textContent = 'Grille 12 col. — G pour masquer';
    overlay.appendChild(info);
    overlay.hidden = true;
    document.body.appendChild(overlay);
  };

  const toggle = () => {
    if (!overlay) build();
    // Colonnes au-delà de --cols masquées
    const cols = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cols'), 10) || 12;
    overlay.querySelectorAll('span').forEach((s, i) => { s.hidden = i >= cols; });
    overlay.hidden = !overlay.hidden;
    announce(overlay.hidden ? 'Grille masquée' : 'Grille affichée');
  };

  // Le basculement attend un court instant : si « j » suit, c'est le début
  // de « gjs » (easter egg du logo) et on n'affiche pas la grille.
  let pending = 0;
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (pending) {
      clearTimeout(pending);
      pending = 0;
      if (key === 'j') return;
      toggle();
    }
    if (key !== 'g') return;
    if (window.innerWidth < 1024 || document.querySelector('.arcade')) return;
    pending = setTimeout(() => { pending = 0; toggle(); }, 320);
  });
}
