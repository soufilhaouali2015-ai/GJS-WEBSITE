/* ==========================================================================
   GJS · DÉMARRAGE
   Pas de librairie : navigation classique, défilement natif, une seule
   animation d'apparition (CSS). Les modules de page sont chargés à la demande
   selon <body data-page="…">.
   ========================================================================== */

import { initMenu } from './core/menu.js';
import { initCookies } from './core/cookies.js';
import { initReveal } from './core/reveal.js';
import { hydrateConfig, hydrateServices } from './core/hydrate.js';

const PAGES = {
  services: () => import('./pages/configurateur.js'),
  contact: () => import('./pages/contact.js'),
};

window.__gjsReady = true;

hydrateConfig();
initMenu();
initReveal();
initCookies();
hydrateServices();

const page = document.body.dataset.page;
if (PAGES[page]) {
  PAGES[page]().then((mod) => mod.default && mod.default());
}
