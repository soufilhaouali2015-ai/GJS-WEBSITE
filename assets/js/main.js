/* ==========================================================================
   GJS · DÉMARRAGE
   Ordre : défilement (Lenis) → header, rideau, pause → boutons, cartes 3D,
   bandeaux → hero → animations au scroll → modules de page.
   Les librairies (GSAP, ScrollTrigger, SplitText, Lenis) sont chargées en
   local avant ce module ; Three.js est importé à la demande par le hero.
   ========================================================================== */

import { profile } from './core/profile.js';
import { initScroll } from './core/scroll.js';
import { initHeader } from './core/header.js';
import { initTransitions } from './core/transition.js';
import { initPause } from './core/pause.js';
import { initButtons } from './core/magnetic.js';
import { initTilt } from './core/tilt.js';
import { initBands } from './core/marquee.js';
import { initMotion } from './core/motion.js';
import { initMenu } from './core/menu.js';
import { initCookies } from './core/cookies.js';
import { hydrateConfig, hydrateServices } from './core/hydrate.js';

const PAGES = {
  services: () => import('./pages/configurateur.js'),
  contact: () => import('./pages/contact.js'),
};

function safe(name, fn) {
  try { fn(); } catch (err) { console.error(`[GJS] ${name}`, err); }
}

async function boot() {
  hydrateConfig();
  safe('menu', initMenu);
  safe('cookies', initCookies);

  if (!window.gsap || !window.ScrollTrigger) {
    // Librairies indisponibles : le site reste entièrement lisible et statique
    document.documentElement.classList.remove('has-motion', 'is-curtain-in');
    return;
  }

  window.__gjsMotion = true; // le JS répond : on garde les états initiaux d'animation
  safe('scroll', initScroll);
  safe('header', initHeader);
  safe('transitions', initTransitions);
  safe('pause', initPause);
  safe('buttons', initButtons);
  safe('tilt', initTilt);
  safe('bands', initBands);

  if (document.querySelector('[data-hero]')) {
    try {
      const { initHero } = await import('./hero/hero.js');
      initHero();
    } catch (err) { console.error('[GJS] hero', err); }
  }

  safe('motion', initMotion);
  hydrateServices();

  const page = document.body.dataset.page;
  if (PAGES[page]) PAGES[page]().then((mod) => mod.default && mod.default());

  // Les polices changent la hauteur des titres : on recalcule les déclencheurs
  document.fonts?.ready.then(() => window.ScrollTrigger.refresh());
  window.addEventListener('load', () => window.ScrollTrigger.refresh(), { once: true });
  document.documentElement.dataset.motionReady = profile;
}

boot();
