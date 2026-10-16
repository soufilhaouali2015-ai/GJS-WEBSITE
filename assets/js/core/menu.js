/* ==========================================================================
   GJS — HEADER & MENU PLEIN ÉCRAN
   Header : masqué au scroll vers le bas, réapparaît au scroll vers le haut.
   Menu : fond noir, liens géants numérotés, aperçu image qui suit le curseur,
   focus piégé, Échap pour fermer, aria-expanded synchronisé.
   ========================================================================== */

import { onScroll, lockScroll, unlockScroll, getScroll } from './scroll.js';
import { env, trapFocus, setInertOutside, announce } from './utils.js';

const { gsap } = window;

let header;
let menu;
let toggle;
let isOpen = false;
let tl = null;
let releaseFocus = null;
let lastY = 0;

function onHeaderScroll(y) {
  if (isOpen || !header) return;
  const delta = y - lastY;
  if (y < 120) header.classList.remove('is-hidden');
  else if (delta > 6) header.classList.add('is-hidden');
  else if (delta < -6) header.classList.remove('is-hidden');
  lastY = y;
}

export function showHeader() {
  if (header) header.classList.remove('is-hidden');
  lastY = getScroll();
}

function buildTimeline() {
  const links = menu.querySelectorAll('.menu__text > span');
  const nums = menu.querySelectorAll('.menu__num');
  const extras = menu.querySelectorAll('.menu__label, .menu__foot > *');
  const t = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  if (env.reducedMotion) {
    t.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'none' });
    return t;
  }
  t.fromTo(menu.querySelector('.menu__bg'), { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' }, 0)
    .fromTo(links, { yPercent: 115 }, { yPercent: 0, duration: 1.1, stagger: 0.06 }, 0.42)
    .fromTo(nums, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.06 }, 0.55)
    .fromTo(extras, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05 }, 0.6);
  return t;
}

export function openMenu() {
  if (isOpen || !menu) return;
  isOpen = true;
  header.classList.remove('is-hidden');
  header.classList.add('is-menu-open');
  menu.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Fermer le menu');
  lockScroll('menu');
  setInertOutside([menu, header], true);
  if (!tl) tl = buildTimeline();
  tl.timeScale(1).play(0);
  releaseFocus = trapFocus(menu, { extra: [toggle], initial: menu.querySelector('.menu__link') });
  announce('Menu ouvert');
}

/** immediate : fermeture sans animation (pendant une transition de page). */
export function closeMenu({ immediate = false, restoreFocus = true } = {}) {
  if (!isOpen || !menu) return Promise.resolve();
  isOpen = false;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Ouvrir le menu');
  header.classList.remove('is-menu-open');
  setInertOutside([menu, header], false);
  if (releaseFocus) { releaseFocus(); releaseFocus = null; }
  if (restoreFocus) toggle.focus({ preventScroll: true });
  unlockScroll('menu');
  hidePreview(true);
  return new Promise((resolve) => {
    const finish = () => { menu.hidden = true; resolve(); };
    if (immediate || !tl) { if (tl) tl.pause(0); finish(); return; }
    tl.eventCallback('onReverseComplete', () => { tl.eventCallback('onReverseComplete', null); finish(); });
    tl.timeScale(2.2).reverse();
  });
}

export const menuIsOpen = () => isOpen;

/* ---------- Aperçu qui suit le curseur ------------------------------------ */

let preview;
let previewImg;
let qx;
let qy;
let previewSrc = '';

function showPreview(src) {
  if (!preview || !env.finePointer) return;
  if (src !== previewSrc) {
    previewSrc = src;
    previewImg.src = src;
    if (!env.reducedMotion) gsap.fromTo(previewImg, { scale: 1.25 }, { scale: 1, duration: 0.9, ease: 'expo.out' });
  }
  gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
}

function hidePreview(immediate = false) {
  if (!preview) return;
  gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: immediate ? 0 : 0.4, ease: 'power2.out', overwrite: 'auto' });
}

/** Marque le lien de la page courante (aria-current). */
export function setCurrentPage(namespace) {
  if (!menu) return;
  menu.querySelectorAll('.menu__link').forEach((link) => {
    if (link.dataset.page === namespace) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function initMenu() {
  header = document.querySelector('[data-header]');
  menu = document.getElementById('menu');
  toggle = document.querySelector('[data-menu-toggle]');
  if (!header || !menu || !toggle) return;

  onScroll(onHeaderScroll);

  toggle.addEventListener('click', () => (isOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) { e.preventDefault(); closeMenu(); }
  });

  preview = menu.querySelector('.menu__preview');
  previewImg = preview && preview.querySelector('img');
  if (preview && env.finePointer) {
    gsap.set(preview, { autoAlpha: 0, scale: 0.85, xPercent: -50, yPercent: -50 });
    qx = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3.out' });
    qy = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3.out' });
    menu.addEventListener('pointermove', (e) => { qx(e.clientX); qy(e.clientY); });
    menu.querySelectorAll('.menu__link').forEach((link) => {
      link.addEventListener('pointerenter', () => showPreview(link.dataset.preview));
      link.addEventListener('pointerleave', () => hidePreview());
    });
  }
}
