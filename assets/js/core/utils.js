/* ==========================================================================
   GJS — UTILITAIRES PARTAGÉS
   ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, inMin, inMax, outMin, outMax) =>
  outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Lissage indépendant du framerate : renvoie le facteur de lerp pour un dt donné. */
export const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt);

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');

export const env = {
  get reducedMotion() { return mqReduced.matches; },
  get finePointer() { return mqFine.matches; },
  get isDesktop() { return window.innerWidth >= 1024; },
  get saveData() { return Boolean(navigator.connection && navigator.connection.saveData); },
};

/** Exécute fn au prochain frame, une seule fois par frame (throttle rAF). */
export function rafThrottle(fn) {
  let id = 0;
  let lastArgs;
  const run = () => { id = 0; fn(...lastArgs); };
  const throttled = (...args) => {
    lastArgs = args;
    if (!id) id = requestAnimationFrame(run);
  };
  throttled.cancel = () => { cancelAnimationFrame(id); id = 0; };
  return throttled;
}

export function debounce(fn, wait = 150) {
  let t = 0;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Rend la main au navigateur (découpe les tâches longues → meilleurs TBT et INP). */
export const yieldToMain = () => new Promise((resolve) => {
  if (window.scheduler && typeof window.scheduler.yield === 'function') window.scheduler.yield().then(resolve);
  else setTimeout(resolve, 0);
});

/** Stockage tolérant (navigation privée, stockage bloqué…). */
export const store = {
  get(key, fallback = null, area = 'local') {
    try {
      const raw = window[`${area}Storage`].getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value, area = 'local') {
    try { window[`${area}Storage`].setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key, area = 'local') {
    try { window[`${area}Storage`].removeItem(key); } catch { /* stockage indisponible */ }
  },
};

/** Annonce un message aux lecteurs d'écran via la région aria-live globale. */
export function announce(message, politeness = 'polite') {
  const region = document.getElementById(politeness === 'assertive' ? 'a11y-alert' : 'a11y-status');
  if (!region) return;
  region.textContent = '';
  // Le décalage force la relecture même si le message est identique.
  setTimeout(() => { region.textContent = message; }, 60);
}

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  '[contenteditable]:not([contenteditable="false"])', 'summary', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusables(root) {
  return $$(FOCUSABLE, root).filter((el) => {
    if (el.closest('[inert], [hidden]')) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && el.getClientRects().length > 0;
  });
}

/**
 * Piège le focus dans `root` (modales, menu). `extra` = éléments hors root à inclure
 * (ex. le bouton MENU du header qui sert aussi à fermer).
 * Renvoie une fonction de libération qui restaure le focus d'origine.
 */
export function trapFocus(root, { extra = [], initial = null, restore = true } = {}) {
  const previous = document.activeElement;
  const list = () => [...extra.filter(Boolean), ...focusables(root)];
  // Ordre de tabulation entièrement géré : les éléments « extra » (hors root)
  // n'ont pas forcément root comme voisin naturel dans le DOM.
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = list();
    e.preventDefault();
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    const step = e.shiftKey ? -1 : 1;
    const next = index === -1 ? (e.shiftKey ? items.length - 1 : 0) : (index + step + items.length) % items.length;
    items[next].focus();
  };
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    const target = initial || list()[0];
    if (target) target.focus({ preventScroll: true });
  });
  return () => {
    document.removeEventListener('keydown', onKey, true);
    if (restore && previous && typeof previous.focus === 'function' && document.contains(previous)) {
      previous.focus({ preventScroll: true });
    }
  };
}

/** Rend inertes les zones hors modale (lecteurs d'écran + clavier). `except` : élément ou tableau. */
export function setInertOutside(except, inert) {
  const kept = [].concat(except).filter(Boolean);
  const keep = new Set([...kept, ...$$('.grain, .cursor, #a11y-status, #a11y-alert')]);
  Array.from(document.body.children).forEach((el) => {
    if (keep.has(el) || kept.some((k) => el.contains(k)) || el.tagName === 'SCRIPT' || el.tagName === 'TEMPLATE') return;
    if (inert) {
      if (!el.inert) { el.inert = true; el.dataset.gjsInert = '1'; }
    } else if (el.dataset.gjsInert) {
      el.inert = false;
      delete el.dataset.gjsInert;
    }
  });
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Charge une image et résout quand elle est décodée (ou en erreur, sans rejeter). */
export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => resolve(img);
    img.src = src;
  });
}

/** Clone le gabarit SVG du vaisseau présent dans chaque page. */
export function createShip(className = '') {
  const tpl = document.getElementById('tpl-ship');
  const node = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (className) node.setAttribute('class', `${node.getAttribute('class') || ''} ${className}`.trim());
  return node;
}

export const formatNumber = (value, decimals = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
