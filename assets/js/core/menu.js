/* ==========================================================================
   GJS · MENU PLEIN ÉCRAN (bouton « Menu », toutes les tailles d'écran)
   Le panneau noir descend sous le header, les liens géants numérotés montent
   en cascade, l'aperçu de la page se colle comme une affiche et change au
   survol ou au focus d'un lien (ordinateur), les coordonnées, réseaux et
   pages légales arrivent en bas. Le bouton « Devis gratuit » reste visible.
   Focus piégé (logo, Devis gratuit, bouton Menu et contenu du menu), Échap
   pour fermer, aria-expanded synchronisé, page inerte et figée derrière.
   Mouvement réduit : simple fondu. Sans GSAP : ouverture immédiate.
   ========================================================================== */

import { $, $$, trapFocus, announce } from './utils.js';
import { isReduced } from './profile.js';
import { getLenis } from './scroll.js';

export function initMenu() {
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (!toggle || !menu) return;
  const { gsap } = window;
  const root = document.documentElement;
  const header = $('.header');
  const label = $('[data-menu-label]', toggle);
  const outside = [$('main'), $('footer')].filter(Boolean);
  const links = $$('.menu__link', menu);
  const previews = $$('[data-preview-img]', menu);
  let open = false;
  let tl = null;
  let release = null;

  const showPreview = (index) => {
    previews.forEach((img) => img.classList.toggle('is-active', img.dataset.previewImg === String(index)));
  };
  const resting = () => {
    const current = links.find((a) => a.getAttribute('aria-current') === 'page');
    showPreview(current ? current.dataset.preview : 0);
  };

  const build = () => {
    if (!gsap) return null;
    const t = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    if (isReduced) return t.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none' });
    return t
      .fromTo($('.menu__bg', menu), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'expo.inOut' }, 0)
      .fromTo($$('.menu__text > span', menu), { yPercent: 115 }, { yPercent: 0, duration: 1, stagger: 0.06 }, 0.28)
      .fromTo($$('.menu__num', menu), { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.06 }, 0.4)
      .fromTo($('.menu__preview', menu), { autoAlpha: 0, y: -30, rotation: -12, scale: 1.12 }, { autoAlpha: 1, y: 0, rotation: -2, scale: 1, duration: 0.9 }, 0.4)
      .fromTo($$('.menu__foot > *', menu), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05 }, 0.45);
  };

  const setOpen = (next, { restoreFocus = true } = {}) => {
    if (next === open) return;
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
    root.classList.toggle('is-menu-open', open);
    outside.forEach((el) => { el.inert = open; });
    if (open) {
      header?.classList.remove('is-hidden');
      menu.hidden = false;
      getLenis()?.stop();
      resting();
      if (tl) tl.kill();
      tl = build();
      if (tl) tl.timeScale(1).play(0);
      // Le logo et « Devis gratuit » restent utilisables pendant que le menu est ouvert
      release = trapFocus(menu, { extra: [$('.header .logo'), $('.header__cta'), toggle] });
      if (links[0]) links[0].focus({ preventScroll: true });
      announce('Menu ouvert');
      return;
    }
    if (release) release();
    release = null;
    getLenis()?.start();
    if (restoreFocus) toggle.focus({ preventScroll: true });
    const finish = () => { if (!open) menu.hidden = true; };
    if (!tl) { finish(); return; }
    tl.eventCallback('onReverseComplete', () => { tl.eventCallback('onReverseComplete', null); finish(); });
    tl.timeScale(2).reverse();
  };

  toggle.addEventListener('click', () => setOpen(!open));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); }
  });

  // Un lien du menu (même une ancre de la page courante) referme le menu
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false, { restoreFocus: false });
  });

  links.forEach((link) => {
    link.addEventListener('pointerenter', () => showPreview(link.dataset.preview));
    link.addEventListener('focus', () => showPreview(link.dataset.preview));
  });
  $('.menu__list', menu)?.addEventListener('pointerleave', resting);

  // Retour arrière depuis le cache du navigateur : le menu repart fermé
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && open) setOpen(false, { restoreFocus: false });
  });
}
