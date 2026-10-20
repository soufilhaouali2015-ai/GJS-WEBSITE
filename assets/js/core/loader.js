/* ==========================================================================
   GJS · ÉCRAN DE CHARGEMENT (première visite seulement)
   Le script du <head> pose .is-loading sur <html> si « gjs-visited » est
   absent : l'écran couvre la page dès le premier affichage. Le sticker GJS
   se colle, le tampon « Bienvenue ! » s'écrase (petite secousse), le compteur
   monte à 100, puis l'écran se lève : tout le minutage est en CSS
   (components.css), il tient en 1,8 s même si la page travaille encore.
   Ici : le compteur, « Passer » (un gestionnaire en ligne le rend actif avant
   ce module), l'annonce aux lecteurs d'écran et le rangement à la fin.
   Mouvement réduit : l'écran s'efface presque aussitôt.
   Aux visites suivantes, seul le rideau entre les pages reste.
   ========================================================================== */

import { announce } from './utils.js';
import { isReduced } from './profile.js';

const KEY = 'gjs-visited';
const COUNT_END = 1400; // ms depuis l'arrivée sur la page (= début de la sortie en CSS)

/** Résout la promesse quand la page est découverte (tout de suite aux visites suivantes). */
export function initLoader() {
  const root = document.documentElement;
  const el = document.querySelector('[data-loader]');
  if (!el || !root.classList.contains('is-loading')) {
    if (el) el.remove();
    root.classList.remove('is-loading');
    return Promise.resolve(false);
  }
  try { window.localStorage.setItem(KEY, '1'); } catch { /* stockage bloqué : l'écran reviendra */ }
  announce('Chargement du site GJS.');

  const count = el.querySelector('[data-loader-count]');
  const skip = el.querySelector('[data-loader-skip]');
  const setCount = (v) => { count.textContent = String(Math.round(v)).padStart(3, '0'); };
  let raf = 0;

  return new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const hadFocus = el.contains(document.activeElement);
      root.classList.remove('is-loading');
      el.remove();
      if (hadFocus) document.getElementById('main')?.focus({ preventScroll: true });
      announce('Site prêt.');
      document.dispatchEvent(new CustomEvent('gjs:loaded'));
      resolve(true);
    };

    // La sortie (CSS) se termine : on range. Filet de sécurité si l'événement se perd.
    el.addEventListener('animationend', (e) => {
      if (e.target === el && (e.animationName === 'loader-exit' || e.animationName === 'loader-fade')) end();
    });
    setTimeout(end, isReduced ? 600 : 2200);

    skip.addEventListener('click', () => {
      setCount(100);
      el.classList.add('is-skipped');
    });
    // Sortie déjà finie avant ce module (page lente, « Passer » cliqué tôt) : on range tout de suite
    const exited = el.getAnimations ? el.getAnimations().some((a) => /^loader-(exit|fade)$/.test(a.animationName) && a.playState === 'finished') : false;
    if (exited) { end(); return; }

    if (isReduced) { setCount(100); return; }
    // Le compteur suit l'horloge de la page (même référence que l'animation CSS)
    const tick = () => {
      const p = Math.min(1, performance.now() / COUNT_END);
      setCount(100 * (1 - (1 - p) ** 3));
      if (p < 1 && !done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
