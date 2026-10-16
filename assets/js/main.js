/* ==========================================================================
   GJS — BOOTSTRAP
   Ordre : plugins GSAP → scroll (Lenis) → UI persistante (curseur, menu,
   cookies, grille, easter eggs) → loader → page courante → Barba.

   Cycle de vie d'une page (chaque module de /pages expose init/intro/destroy) :
     init(scope, container)   préparation (DOM, états initiaux, interactions)
     intro(scope, container, tl)  animations d'entrée, ScrollTriggers
     destroy()                 nettoyage spécifique (le scope détruit le reste)
   ========================================================================== */

import { env, $, announce, yieldToMain } from './core/utils.js';
import { createScope } from './core/scope.js';
import { initScroll, resetScroll, scrollTo, resizeScroll, lockScroll, unlockScroll } from './core/scroll.js';
import { createReveals, setInitialTheme } from './core/reveal.js';
import { runLoader } from './core/loader.js';
import { initCursor } from './core/cursor.js';
import { refreshMagnetic } from './core/magnetic.js';
import { createMarquee } from './core/marquee.js';
import { initMenu, closeMenu, menuIsOpen, setCurrentPage, showHeader } from './core/menu.js';
import { initTransition, curtainIn, curtainOut, pageSlug } from './core/transitions.js';
import { syncHead } from './core/head.js';
import { initCookies, maybeShowBanner } from './core/cookies.js';
import { initFooter, hydrateConfig } from './core/footer.js';
import { initCta } from './core/cta.js';
import { initAccordions } from './core/accordion.js';
import { initGridOverlay } from './core/grid.js';
import { initEasterEggs } from './easter-egg.js';

const { gsap, ScrollTrigger, SplitText, Flip, CustomEase, barba } = window;

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase);
CustomEase.create('gjs', 'M0,0 C0.08,0.62 0.18,0.92 0.42,0.98 0.66,1.01 0.8,1 1,1');
CustomEase.create('gjs-inout', '0.76,0,0.24,1');
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.config({ nullTargetWarn: false });

document.documentElement.classList.toggle('is-reduced-motion', env.reducedMotion);
document.documentElement.classList.toggle('is-touch', !env.finePointer);

const PAGES = {
  home: () => import('./pages/home.js'),
  offres: () => import('./pages/offres.js'),
  about: () => import('./pages/about.js'),
  contact: () => import('./pages/contact.js'),
  legal: () => import('./pages/legal.js'),
  error: () => import('./pages/error.js'),
};

let current = null;

/* ---------- Montage / démontage de page ---------------------------------- */

async function mountPage(container) {
  const namespace = container.dataset.barbaNamespace || 'legal';
  const mod = await (PAGES[namespace] || PAGES.legal)();
  const page = mod.default;
  const scope = createScope(container);

  hydrateConfig(container);
  setInitialTheme(container);
  // Tout ce qui crée des tweens persistants (quickTo…) passe par le contexte de page
  scope.add(() => {
    initFooter(scope, container);
    initCta(scope, container);
    initAccordions(scope, container);
    container.querySelectorAll('[data-marquee]').forEach((el) => createMarquee(el, scope));
  });

  // Les ScrollTriggers des modules doivent être créés dans le contexte de page
  await scope.add(() => page.init && page.init(scope, container));

  // Recalcul quand la hauteur de page change (accordéons, images, polices)
  let lastHeight = 0;
  scope.resize(container, () => {
    const h = container.offsetHeight;
    if (Math.abs(h - lastHeight) > 2) {
      lastHeight = h;
      clearTimeout(scope._refreshTimer);
      scope._refreshTimer = setTimeout(() => { ScrollTrigger.refresh(); resizeScroll(); }, 180);
    }
  });
  scope.cleanup(() => clearTimeout(scope._refreshTimer));

  current = { namespace, page, scope, container };
  setCurrentPage(namespace);
  return current;
}

async function introPage() {
  if (!current) return;
  const { page, scope, container } = current;
  // 1. Ce qui est visible tout de suite (enchaînement continu avec le loader / rideau)
  scope.add(() => {
    const tl = createReveals(container, { phase: 'intro' });
    if (page.intro) page.intro(scope, container, tl);
    tl.play();
  });
  refreshMagnetic();
  // 2. Le reste (reveals au scroll, compteurs, thèmes) dans une tâche suivante
  await yieldToMain();
  if (scope.destroyed) return;
  scope.add(() => createReveals(container, { phase: 'scroll' }));
  await yieldToMain();
  if (scope.destroyed) return;
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

function unmountPage() {
  if (!current) return;
  const { page, scope } = current;
  try { if (page.destroy) page.destroy(); } finally { scope.destroy(); }
  current = null;
}

/* ---------- Liens vers la page courante ----------------------------------- */

function samePath(href) {
  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin && pageSlug(url.pathname) === pageSlug(window.location.pathname);
}

function handleSamePageLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (link.target === '_blank' || link.hasAttribute('download') || link.dataset.noBarba !== undefined) return;
    const url = new URL(link.href, window.location.href);
    if (url.protocol !== window.location.protocol || !samePath(url.href)) return;
    e.preventDefault();
    e.stopPropagation();
    const go = () => {
      if (url.hash && url.hash.length > 1) {
        const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) {
          scrollTo(target, { offset: 0 });
          history.replaceState(history.state, '', url.hash);
          target.setAttribute('tabindex', target.getAttribute('tabindex') || '-1');
          target.focus({ preventScroll: true });
        }
      } else {
        scrollTo(0);
      }
    };
    if (menuIsOpen()) closeMenu({ restoreFocus: false }).then(go);
    else go();
  }, true);
}

/* ---------- Barba ---------------------------------------------------------- */

function focusNewPage(container, url) {
  const main = container.querySelector('main') || container;
  main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
  announce(`Page chargée : ${document.title}`);
  if (url && url.hash) {
    const target = document.getElementById(url.hash.replace('#', ''));
    if (target) setTimeout(() => scrollTo(target, { immediate: false }), 250);
  }
}

function initBarba() {
  if (!barba) return;
  barba.init({
    debug: false,
    timeout: 10000,
    preventRunning: true,
    prevent: ({ el, href }) => Boolean(
      el.closest('[data-no-barba]')
      || /\.(pdf|zip|jpe?g|png|webp|avif|mp4|webm|svg|xml|txt)$/i.test(href.split('?')[0])
    ),
    transitions: [{
      name: 'gjs-curtain',
      async leave(data) {
        document.documentElement.classList.add('is-transitioning');
        lockScroll('transition');
        document.dispatchEvent(new CustomEvent('gjs:before-leave'));
        await curtainIn(data.next.url.path || data.next.url.href);
        if (menuIsOpen()) await closeMenu({ immediate: true, restoreFocus: false });
      },
      afterLeave() {
        unmountPage();
      },
      async beforeEnter(data) {
        data.current.container.remove();
        await syncHead(data.next.html);
        resetScroll();
        showHeader();
        await mountPage(data.next.container);
      },
      async enter() {
        unlockScroll('transition');
        await curtainOut(() => introPage());
      },
      after(data) {
        document.documentElement.classList.remove('is-transitioning');
        focusNewPage(data.next.container, data.next.url);
      },
    }],
  });
}

/* ---------- Démarrage ------------------------------------------------------ */

async function boot() {
  initScroll();
  initTransition();
  initMenu();
  initCursor();
  initGridOverlay();
  initCookies({ showBanner: false });
  initEasterEggs();
  handleSamePageLinks();

  // Lancement des jeux depuis n'importe quel bouton [data-launch-game]
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-launch-game]');
    if (!btn) return;
    e.preventDefault();
    const { openGame } = await import('./games/arcade.js');
    openGame(btn.dataset.launchGame, btn);
  });

  const container = $('[data-barba="container"]');
  const video = container && container.querySelector('[data-hero-video]');
  const loader = runLoader({ video });

  if (container) await mountPage(container);
  await loader.revealed;
  introPage();
  await loader.done;

  // Ancre dans l'URL d'arrivée (ex. index.html#arcade)
  if (window.location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target) scrollTo(target, { immediate: true });
  }

  maybeShowBanner();
  initBarba();
}

boot().catch((err) => {
  // En cas d'échec, on libère toujours l'interface
  document.getElementById('loader')?.remove();
  document.documentElement.classList.remove('is-scroll-locked');
  throw err;
});
