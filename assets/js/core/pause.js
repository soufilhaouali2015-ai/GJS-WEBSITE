/* ==========================================================================
   GJS · PAUSE DES ANIMATIONS AUTOMATIQUES (WCAG 2.2.2)
   Un seul bouton (dans le hero) arrête la vidéo, la scène WebGL et les
   bandeaux qui défilent. Les animations déclenchées par le visiteur
   (survols, scroll) restent actives.
   ========================================================================== */

const listeners = new Set();
let paused = false;

export const isPaused = () => paused;

export function onPause(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setPaused(next) {
  paused = Boolean(next);
  document.documentElement.classList.toggle('is-paused', paused);
  // Le libellé dit l'action (pas d'aria-pressed en plus : l'annonce serait contradictoire)
  document.querySelectorAll('[data-pause-label]').forEach((label) => {
    label.textContent = paused ? 'Relancer les animations' : 'Mettre en pause';
  });
  listeners.forEach((cb) => cb(paused));
}

export function initPause() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-motion-pause]')) setPaused(!paused);
  });
}
