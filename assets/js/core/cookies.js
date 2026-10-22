/* ==========================================================================
   GJS · CONSENTEMENT COOKIES (RGPD / lignes directrices CNIL)
   • Aucun script de mesure avant consentement explicite.
   • « Tout refuser » aussi simple et visible que « Tout accepter ».
   • Choix mémorisé 6 mois puis redemandé ; versionné (CONFIG.CONSENT_VERSION).
   • Lien « Gérer les cookies » dans le footer pour revenir sur son choix.
   ========================================================================== */

import { CONFIG } from '../config.js';
import { store, announce, env } from './utils.js';

const KEY = 'gjs-consent';
const CATEGORIES = ['analytics', 'marketing'];

let banner;
let prefs;
let consent = null;
let lastFocus = null;
const subscribers = new Map();
const loaded = new Set();

function readConsent() {
  const saved = store.get(KEY);
  if (!saved) return null;
  const age = (Date.now() - new Date(saved.date).getTime()) / 86400000;
  // Choix périmé (6 mois) ou d'une ancienne version : on l'efface et on redemande
  if (saved.v !== CONFIG.CONSENT_VERSION || !Number.isFinite(age) || age > CONFIG.CONSENT_MAX_AGE_DAYS) {
    try { window.localStorage.removeItem(KEY); } catch { /* stockage bloqué */ }
    return null;
  }
  return saved;
}

export const getConsent = () => consent;
export const hasConsent = (category) => Boolean(consent && consent[category]);

/** Exécute cb dès que (et seulement si) la catégorie est acceptée. */
export function onConsent(category, cb) {
  if (!subscribers.has(category)) subscribers.set(category, new Set());
  subscribers.get(category).add(cb);
  if (hasConsent(category)) cb();
}

function loadAnalytics() {
  const cfg = CONFIG.ANALYTICS;
  if (!cfg || !cfg.src || loaded.has('analytics')) return;
  loaded.add('analytics');
  const s = document.createElement('script');
  s.src = cfg.src;
  s.defer = true;
  Object.entries(cfg.attrs || {}).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.appendChild(s);
}

function apply(next) {
  const previous = consent;
  consent = { v: CONFIG.CONSENT_VERSION, date: new Date().toISOString(), ...next };
  store.set(KEY, consent);
  CATEGORIES.forEach((cat) => {
    if (consent[cat]) (subscribers.get(cat) || []).forEach((cb) => cb());
  });
  // Un traceur déjà chargé ne peut pas être « déchargé » : on recharge la page.
  const revoked = previous && CATEGORIES.some((cat) => previous[cat] && !consent[cat] && loaded.has(cat));
  if (revoked) window.location.reload();
}

function syncPrefsForm() {
  CATEGORIES.forEach((cat) => {
    const input = prefs && prefs.querySelector(`input[name="${cat}"]`);
    if (input) input.checked = hasConsent(cat);
  });
}

function togglePrefs(open) {
  if (!prefs) return;
  prefs.hidden = !open;
  const btn = banner.querySelector('[data-consent="customize"]');
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

// Tant que le bandeau est affiché, le défilement au focus clavier garde de la
// place en bas de l'écran : un élément ne se cache jamais derrière (WCAG 2.4.11)
let sizeWatch = null;
function reserveSpace(on) {
  const root = document.documentElement;
  if (sizeWatch) { sizeWatch.disconnect(); sizeWatch = null; }
  if (!on) { root.style.removeProperty('--cookies-space'); return; }
  const set = () => root.style.setProperty('--cookies-space', `${Math.ceil(banner.offsetHeight) + 24}px`);
  set();
  if ('ResizeObserver' in window) { sizeWatch = new ResizeObserver(set); sizeWatch.observe(banner); }
}

function show({ customize = false, focus = false } = {}) {
  if (!banner) return;
  lastFocus = focus ? document.activeElement : null;
  syncPrefsForm();
  togglePrefs(customize);
  banner.hidden = false;
  reserveSpace(true);
  if (!env.reducedMotion) {
    banner.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.remove('is-entering')));
  }
  if (focus) {
    const target = customize ? prefs.querySelector('input:not([disabled])') : banner.querySelector('[data-consent="reject"]');
    requestAnimationFrame(() => target && target.focus());
  }
}

function hide() {
  if (!banner) return;
  banner.hidden = true;
  reserveSpace(false);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

// Focus clavier sur un élément que le bandeau recouvre encore après le défilement
// (zone épinglée, bas de page) : le bandeau change de côté
function dodge(e) {
  if (!banner || banner.hidden || banner.contains(e.target)) return;
  const check = () => {
    if (banner.hidden || document.activeElement !== e.target) return;
    const r = e.target.getBoundingClientRect();
    const b = banner.getBoundingClientRect();
    if (!(r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right)) return;
    const wide = window.matchMedia('(min-width: 640px)').matches;
    const away = wide ? r.left + r.width / 2 > window.innerWidth / 2 : r.top + r.height / 2 > window.innerHeight / 2;
    banner.classList.toggle('is-dodged', away);
  };
  // Tout de suite, puis une fois le défilement (et les scènes épinglées) posés
  requestAnimationFrame(check);
  setTimeout(check, 400);
}

export function initCookies({ showBanner = true } = {}) {
  banner = document.getElementById('cookies');
  document.addEventListener('focusin', dodge);
  prefs = document.getElementById('cookies-prefs');
  // Choix existant : on ne le réécrit pas (sa date d'origine fait foi pour l'expiration)
  consent = readConsent();
  onConsent('analytics', loadAnalytics);

  if (!banner) return;

  banner.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    const action = btn.dataset.consent;
    if (action === 'accept') {
      apply({ analytics: true, marketing: true });
      announce('Tous les cookies ont été acceptés.');
      hide();
    } else if (action === 'reject') {
      apply({ analytics: false, marketing: false });
      announce('Tous les cookies optionnels ont été refusés.');
      hide();
    } else if (action === 'customize') {
      togglePrefs(prefs.hidden);
    }
  });

  if (prefs) {
    prefs.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(prefs);
      apply({ analytics: data.has('analytics'), marketing: data.has('marketing') });
      announce('Vos préférences cookies sont enregistrées.');
      hide();
    });
  }

  // « Gérer les cookies » (footer, page confidentialité)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cookie-manage]')) {
      e.preventDefault();
      show({ customize: true, focus: true });
    }
  });

  // Échap ferme le panneau de préférences ouvert depuis « Gérer les cookies »
  banner.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && consent) hide();
  });

  if (!consent && showBanner) show();
}

/** Affiche le bandeau si aucun choix n'a encore été fait (appelé après l'écran de chargement). */
export function maybeShowBanner() {
  if (!consent && banner && banner.hidden) show();
}
