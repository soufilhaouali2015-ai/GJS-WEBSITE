/* ==========================================================================
   GJS · UTILITAIRES PARTAGÉS
   ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

export const env = {
  get reducedMotion() { return mqReduced.matches; },
};

/** Stockage tolérant (navigation privée, stockage bloqué…). */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

/** Annonce un message aux lecteurs d'écran via les régions aria-live globales. */
export function announce(message, politeness = 'polite') {
  const region = document.getElementById(politeness === 'assertive' ? 'a11y-alert' : 'a11y-status');
  if (!region) return;
  region.textContent = '';
  // Le décalage force la relecture même si le message est identique.
  setTimeout(() => { region.textContent = message; }, 60);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function focusables(root) {
  return $$(FOCUSABLE, root).filter((el) => !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
}

/**
 * Piège le focus dans `root` (menu mobile). `extra` = éléments hors root à inclure
 * (le bouton qui ouvre/ferme). Renvoie une fonction de libération.
 */
export function trapFocus(root, { extra = [] } = {}) {
  const list = () => [...extra.filter(Boolean), ...focusables(root)];
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = list();
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    const next = e.shiftKey
      ? (index <= 0 ? items.length - 1 : index - 1)
      : (index === -1 || index === items.length - 1 ? 0 : index + 1);
    e.preventDefault();
    items[next].focus();
  };
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}
