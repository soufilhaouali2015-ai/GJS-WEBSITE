/* ==========================================================================
   GJS — REVEALS & SCROLL FX GÉNÉRIQUES (pilotés par attributs data-*)

   data-split="lines|chars"   reveal de texte masqué (lignes / caractères)
   data-reveal="fade|image|line|stagger"
   data-intro                 joué à l'entrée de page (après loader / transition)
   data-delay="0.2"           décalage (s) dans l'intro
   data-parallax="0.2"        profondeur de parallaxe (négatif = sens inverse)
   data-counter="140"         compteur (+ data-prefix, data-suffix, data-decimals)
   data-theme="night|black|paper|deep"  couleur du body quand la section est au centre
   ========================================================================== */

import { split } from './splitText.js';
import { env, $$, formatNumber } from './utils.js';

const { gsap, ScrollTrigger } = window;

export const THEMES = {
  night: { '--bg': '#060B1E', '--fg': '#FFFFFF', '--fg-2': 'rgba(255, 255, 255, 0.64)', '--line': 'rgba(255, 255, 255, 0.14)', '--focus': '#5B85FF', '--danger': '#FF6B5B' },
  deep: { '--bg': '#03060F', '--fg': '#FFFFFF', '--fg-2': 'rgba(255, 255, 255, 0.62)', '--line': 'rgba(255, 255, 255, 0.13)', '--focus': '#5B85FF', '--danger': '#FF6B5B' },
  black: { '--bg': '#000000', '--fg': '#FFFFFF', '--fg-2': 'rgba(255, 255, 255, 0.62)', '--line': 'rgba(255, 255, 255, 0.16)', '--focus': '#5B85FF', '--danger': '#FF6B5B' },
  paper: { '--bg': '#F2F1EC', '--fg': '#03060F', '--fg-2': 'rgba(3, 6, 15, 0.68)', '--line': 'rgba(3, 6, 15, 0.16)', '--focus': '#24387A', '--danger': '#B3261E' },
};

let currentTheme = 'night';

export function setTheme(name, immediate = false) {
  const theme = THEMES[name];
  if (!theme || (name === currentTheme && !immediate)) return;
  currentTheme = name;
  document.body.dataset.currentTheme = name;
  document.documentElement.style.colorScheme = name === 'paper' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme['--bg']);
  gsap.to(document.body, {
    ...theme,
    duration: immediate || env.reducedMotion ? 0 : 0.8,
    ease: 'power2.out',
    overwrite: true,
  });
}

/** Thème initial d'une page : celui de sa première section. */
export function setInitialTheme(container) {
  const first = container.querySelector('[data-theme]');
  setTheme(first ? first.dataset.theme : 'night', true);
}

const EASE = 'gjs';

function lineReveal(el, { intro, tl }) {
  // Mouvement réduit : simple fondu, aucun découpage.
  if (env.reducedMotion) { fadeReveal(el, { intro, tl }); return; }
  const delay = parseFloat(el.dataset.delay || 0);
  const isChars = el.dataset.split === 'chars';
  const vars = isChars
    ? { yPercent: 118, rotate: 7, transformOrigin: '0% 100%', stagger: 0.028, duration: 1.15, ease: EASE }
    : { yPercent: 112, stagger: 0.08, duration: 1.1, ease: EASE };
  // L'animation est recréée à chaque redécoupage (polices, resize) : on garde
  // une référence mutable pour que l'intro lance toujours la version courante.
  let current = null;
  let started = false;
  let scheduled = false;
  split(el, {
    type: isChars ? 'chars' : 'lines',
    mask: 'lines',
    onSplit(self) {
      const targets = isChars ? self.chars : self.lines;
      if (intro) {
        current = gsap.from(targets, { ...vars, paused: !started });
        if (!scheduled) {
          scheduled = true;
          tl.add(() => { started = true; if (current) current.play(); }, delay);
        }
        return current;
      }
      return gsap.from(targets, { ...vars, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    },
  });
}

function fadeReveal(el, { intro, tl }) {
  const delay = parseFloat(el.dataset.delay || 0);
  const vars = env.reducedMotion
    ? { opacity: 0, duration: 0.6 }
    : { opacity: 0, y: 28, duration: 1, ease: 'power3.out' };
  if (intro) tl.from(el, vars, delay);
  else gsap.from(el, { ...vars, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
}

function staggerReveal(el, { intro, tl }) {
  const delay = parseFloat(el.dataset.delay || 0);
  const items = Array.from(el.children);
  const vars = env.reducedMotion
    ? { opacity: 0, duration: 0.5, stagger: 0.04 }
    : { opacity: 0, y: 32, duration: 0.9, ease: 'power3.out', stagger: 0.07 };
  if (intro) tl.from(items, vars, delay);
  else gsap.from(items, { ...vars, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
}

function imageReveal(el, { intro, tl }) {
  const delay = parseFloat(el.dataset.delay || 0);
  const media = el.querySelector('img, video, canvas');
  const dir = el.dataset.revealDir || 'up';
  const from = {
    up: 'inset(100% 0% 0% 0%)',
    down: 'inset(0% 0% 100% 0%)',
    left: 'inset(0% 100% 0% 0%)',
    right: 'inset(0% 0% 0% 100%)',
    center: 'inset(50% 50% 50% 50%)',
  }[dir];
  const build = (t, position) => {
    if (env.reducedMotion) {
      t.from(el, { opacity: 0, duration: 0.6 }, position);
      return;
    }
    t.fromTo(el, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' }, position);
    if (media) t.fromTo(media, { scale: 1.3 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, position + 0.1);
  };
  if (intro) build(tl, delay);
  else {
    const t = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    build(t, 0);
  }
}

function lineDraw(el, { intro, tl }) {
  const vars = { scaleX: 0, transformOrigin: '0% 50%', duration: 1.4, ease: 'expo.out' };
  if (intro) tl.from(el, vars, parseFloat(el.dataset.delay || 0));
  else gsap.from(el, { ...vars, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
}

function parallax(el) {
  if (env.reducedMotion) return;
  const depth = parseFloat(el.dataset.parallax) || 0.15;
  const trigger = el.closest('[data-parallax-root]') || el.parentElement;
  gsap.fromTo(el, { y: () => depth * window.innerHeight * 0.5 }, {
    y: () => -depth * window.innerHeight * 0.5,
    ease: 'none',
    scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
  });
}

function counter(el) {
  const target = parseFloat(el.dataset.counter);
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const render = (v) => { el.textContent = `${prefix}${formatNumber(v, decimals)}${suffix}`; };
  if (env.reducedMotion) { render(target); return; }
  const state = { v: 0 };
  render(0);
  gsap.to(state, {
    v: target,
    duration: 2.2,
    ease: 'power3.out',
    onUpdate: () => render(state.v),
    scrollTrigger: { trigger: el, start: 'top 85%', once: true },
  });
}

function themeTriggers(container) {
  $$('[data-theme]', container).forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) setTheme(section.dataset.theme); },
    });
  });
}

/**
 * Crée toutes les animations génériques d'une page.
 * Doit être appelé dans scope.add() pour être détruit avec la page.
 * Renvoie la timeline d'intro (éléments [data-intro]).
 */
export function createReveals(container, { phase = 'all' } = {}) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
  const opts = (el) => ({ intro: el.hasAttribute('data-intro'), tl });
  // phase 'intro' : éléments [data-intro] (immédiat) ; 'scroll' : le reste (différé)
  const want = (el) => phase === 'all' || (phase === 'intro') === el.hasAttribute('data-intro');
  const each = (sel, fn) => $$(sel, container).filter(want).forEach((el) => fn(el, opts(el)));

  each('[data-split]', lineReveal);
  each('[data-reveal="fade"]', fadeReveal);
  each('[data-reveal="stagger"]', staggerReveal);
  each('[data-reveal="image"]', imageReveal);
  each('[data-reveal="line"]', lineDraw);
  if (phase !== 'intro') {
    $$('[data-parallax]', container).forEach(parallax);
    $$('[data-counter]', container).forEach(counter);
    themeTriggers(container);
  }

  return tl;
}
