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
  if (!saved || saved.v !== CONFIG.CONSENT_VERSION) return null;
  const age = (Date.now() - new Date(saved.date).getTime()) / 86400000;
  if (!Number.isFinite(age) || age > CONFIG.CONSENT_MAX_AGE_DAYS) return null;
  return saved;
}

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

function show({ customize = false, focus = false } = {}) {
  if (!banner) return;
  lastFocus = focus ? document.activeElement : null;
  syncPrefsForm();
  togglePrefs(customize);
  banner.hidden = false;
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
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

export function initCookies() {
  banner = document.getElementById('cookies');
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

  if (!consent) show();
}
