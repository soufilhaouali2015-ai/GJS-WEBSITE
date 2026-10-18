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
  document.querySelectorAll('[data-motion-pause]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(paused));
    const label = btn.querySelector('[data-pause-label]');
    if (label) label.textContent = paused ? 'Relancer les animations' : 'Mettre en pause';
  });
  listeners.forEach((cb) => cb(paused));
}

export function initPause() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-motion-pause]')) setPaused(!paused);
  });
}
