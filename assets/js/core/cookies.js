/* ==========================================================================
   GJS — CONSENTEMENT COOKIES (RGPD / lignes directrices CNIL)
   • Aucun script de mesure avant consentement explicite.
   • « Tout refuser » aussi simple et visible que « Tout accepter ».
   • Choix mémorisé 6 mois puis redemandé ; versionné (CONFIG.CONSENT_VERSION).
   • Lien « Gérer les cookies » dans le footer pour revenir sur son choix.
   ========================================================================== */

import { CONFIG } from '../config.js';
import { store, announce } from './utils.js';

const { gsap } = window;
const KEY = 'gjs-consent';
const CATEGORIES = ['analytics', 'marketing'];

let banner;
let prefs;
let consent = null;
const subscribers = new Map(); // catégorie → Set de callbacks
const loaded = new Set();

function readConsent() {
  const saved = store.get(KEY);
  if (!saved || saved.v !== CONFIG.CONSENT_VERSION) return null;
  const age = (Date.now() - new Date(saved.date).getTime()) / 86400000;
  if (!Number.isFinite(age) || age > CONFIG.CONSENT_MAX_AGE_DAYS) return null;
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
  if (!prefs) return;
  CATEGORIES.forEach((cat) => {
    const input = prefs.querySelector(`input[name="${cat}"]`);
    if (input) input.checked = hasConsent(cat);
  });
}

function show({ customize = false, focus = false } = {}) {
  if (!banner) return;
  banner.hidden = false;
  syncPrefsForm();
  togglePrefs(customize);
  gsap.fromTo(banner, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' });
  if (focus) {
    const target = customize ? prefs.querySelector('input:not([disabled])') : banner.querySelector('[data-consent="reject"]');
    requestAnimationFrame(() => target && target.focus());
  }
}

function hide() {
  if (!banner) return;
  gsap.to(banner, {
    autoAlpha: 0, y: 24, duration: 0.4, ease: 'power2.in',
    onComplete: () => { banner.hidden = true; },
  });
}

function togglePrefs(open) {
  if (!prefs) return;
  prefs.hidden = !open;
  const btn = banner.querySelector('[data-consent="customize"]');
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

export function initCookies({ showBanner = true } = {}) {
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

  // « Gérer les cookies » (footer, page confidentialité) — délégation globale
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cookie-manage]')) {
      e.preventDefault();
      show({ customize: true, focus: true });
    }
  });

  if (!consent && showBanner) show();
}

/** Affiche le bandeau si aucun choix n'a encore été fait (appelé après le loader). */
export function maybeShowBanner() {
  if (!consent && banner && banner.hidden) show();
}
