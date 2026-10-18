/* ==========================================================================
   GJS · TRANSITION ENTRE LES PAGES
   Rideau citron avec le logo GJS : 0,3 s pour couvrir, 0,3 s pour découvrir.
   La navigation reste classique (pas d'application d'une seule page) :
   bouton retour, ancres, nouvel onglet et Ctrl/Cmd+clic marchent normalement.
   Le <head> pose .is-curtain-in à l'arrivée (rideau visible dès le premier
   affichage, sans flash) ; il s'efface seul en CSS si le JS ne répond pas.
   ========================================================================== */

import { isReduced } from './profile.js';
import { scrollTo } from './scroll.js';

const { gsap } = window;
const KEY = 'gjs-curtain';
const root = document.documentElement;

const normalize = (path) => path.replace(/\/index\.html$/, '/').replace(/\/$/, '/');

function reveal(curtain) {
  if (!root.classList.contains('is-curtain-in')) return;
  const logo = curtain.querySelector('.curtain__logo');
  gsap.timeline({
    onComplete: () => {
      root.classList.remove('is-curtain-in');
      gsap.set([curtain, logo], { clearProps: 'all' });
    },
  })
    .set(curtain, { animation: 'none', y: 0, yPercent: 0 })
    .to(logo, { yPercent: -60, autoAlpha: 0, duration: 0.3, ease: 'expo.out' }, 0)
    .to(curtain, { yPercent: -101, duration: 0.32, ease: 'expo.out' }, 0.04);
}

function leave(curtain, href) {
  let gone = false;
  const go = () => { if (!gone) { gone = true; window.location.href = href; } };
  try { sessionStorage.setItem(KEY, '1'); } catch { /* stockage bloqué : pas de rideau à l'arrivée */ }
  root.classList.add('is-leaving');
  const logo = curtain.querySelector('.curtain__logo');
  gsap.timeline({ onComplete: go })
    .fromTo(curtain, { y: 0, yPercent: 101 }, { yPercent: 0, duration: 0.3, ease: 'expo.out' })
    .fromTo(logo, { scale: 1.5, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: -4, autoAlpha: 1, duration: 0.28, ease: 'expo.out' }, 0.06);
  setTimeout(go, 700); // filet de sécurité
}

export function initTransitions() {
  const curtain = document.querySelector('.curtain');
  if (!curtain) return;
  reveal(curtain);

  // Retour arrière depuis le cache du navigateur : la page revient sans rideau
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    root.classList.remove('is-leaving', 'is-curtain-in');
    gsap.killTweensOf(curtain);
    gsap.set([curtain, curtain.querySelector('.curtain__logo')], { clearProps: 'all' });
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
    const samePage = normalize(url.pathname) === normalize(window.location.pathname) && url.search === window.location.search;

    if (samePage) {
      if (!url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      history.pushState(null, '', url.hash);
      scrollTo(target);
      target.setAttribute('tabindex', target.getAttribute('tabindex') || '-1');
      target.focus({ preventScroll: true });
      return;
    }
    if (!/(\.html|\/)$/.test(url.pathname)) return; // fichiers (pdf, images…) : comportement normal
    if (isReduced) return;
    e.preventDefault();
    leave(curtain, url.href);
  });
}
