/* ==========================================================================
   GJS · MENU MOBILE (burger, < 900 px)
   aria-expanded synchronisé, focus piégé, Échap pour fermer, page inerte
   derrière le menu. Sur ordinateur, la navigation est toujours visible.
   ========================================================================== */

import { $, trapFocus } from './utils.js';

const DESKTOP = window.matchMedia('(min-width: 900px)');

export function initMenu() {
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (!toggle || !menu) return;
  const label = $('[data-menu-label]', toggle);
  const outside = [$('main'), $('footer')].filter(Boolean);
  let release = null;

  const setOpen = (open, { restoreFocus = true } = {}) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
    document.documentElement.classList.toggle('is-menu-open', open);
    outside.forEach((el) => { el.inert = open; });
    if (open) {
      release = trapFocus(menu, { extra: [toggle] });
      const first = menu.querySelector('a');
      if (first) first.focus();
    } else {
      if (release) release();
      release = null;
      if (restoreFocus) toggle.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(menu.hidden));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });

  // Un lien du menu (même une ancre de la page courante) referme le menu
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false, { restoreFocus: false });
  });

  DESKTOP.addEventListener('change', (e) => {
    if (e.matches && !menu.hidden) setOpen(false, { restoreFocus: false });
  });
}
