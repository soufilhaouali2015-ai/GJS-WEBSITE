/* ==========================================================================
   GJS · PAGE À PROPOS
   Intro : G, J et S montent derrière leur masque, le portrait de chaque
   associé se colle comme un sticker (CSS). Au scroll, les stickers se
   décollent, les écarts se referment et les lettres se rassemblent en GJS,
   qui grandit jusqu'à remplir la largeur puis reçoit son trait citron
   (hero épinglé sur ordinateur, effet lié à sa sortie sur mobile).
   Vision : « des livrables » se barre et « des résultats » se souligne au
   fil du scroll. Valeurs : cartes qui se retournent (survol, focus clavier,
   clic ou toucher). Trajectoire : la frise se remplit et allume chaque date.
   Mouvement réduit : compositions finales, sans animation liée au scroll.
   ========================================================================== */

import { $, $$ } from '../core/utils.js';
import { isReduced, isDesktop } from '../core/profile.js';

const { gsap, ScrollTrigger } = window;
const root = document.documentElement;

/** Décalage vertical de `el` dans `ancestor`, sans tenir compte des transforms. */
function offsetWithin(el, ancestor) {
  let y = 0;
  for (let node = el; node && node !== ancestor; node = node.offsetParent) y += node.offsetTop;
  return y;
}

/* ---- Intro : G · J · S ---------------------------------------------------- */

const GAP = 0.3; // écart entre deux lettres au départ (em du mot)
const GAP_END = 0.02; // écart final : les lettres se touchent presque

function initHero() {
  const hero = $('[data-about-hero]');
  const word = hero && $('[data-about-word]', hero);
  if (!word || isReduced) return;
  const pin = $('[data-about-pin]', hero);
  const stage = $('[data-about-stage]', hero);
  const glyphs = $$('.about-hero__glyph', word);
  const gaps = $$('[data-gap]', word);
  const photos = $$('[data-photo]', word);
  const mark = $('[data-word-mark]', word);
  const fades = $$('[data-hero-fade]', hero);

  // Mesures de mise en page (insensibles aux transforms), reprises à chaque refresh
  let m = null;
  const measure = () => {
    const fs = parseFloat(getComputedStyle(word).fontSize) || 100;
    const flexGap = parseFloat(getComputedStyle(word).columnGap) || 0;
    const top = offsetWithin(word, pin);
    m = {
      fs,
      fixed: glyphs.reduce((sum, el) => sum + el.offsetWidth, 0) + flexGap * (glyphs.length + gaps.length - 1),
      stage: stage.clientWidth,
      cap: glyphs[0].offsetHeight || fs * 0.7,
      center: top + word.offsetHeight / 2,
      height: word.offsetHeight,
      // Mobile : place libre entre le header et le haut du mot, page en haut
      room: offsetWithin(word, document.body) - ($('.header')?.offsetHeight || 0) - 12,
    };
  };
  ScrollTrigger.addEventListener('refreshInit', measure);
  let applyNow = null;
  new ResizeObserver(() => { measure(); if (applyNow) applyNow(); }).observe(stage);

  // Ordinateur et écran assez haut : hero épinglé, le mot glisse au centre de l'écran.
  // Mobile : l'effet suit simplement la sortie du hero (pas d'épinglage au doigt), sur
  // une course courte calée pour que le mot reste entier sous le header ; il grandit
  // vers le haut (sans toucher au titre dessous), dans la place qu'il lui reste.
  const pinned = isDesktop && window.matchMedia('(min-height: 560px)').matches;
  const course = () => {
    if (!m) measure();
    if (pinned) return Math.round(window.innerHeight * 0.9);
    // Jamais plus que la place libre : sur petit écran, le mot finit de se former
    // juste sous le header, encore affiché à ce moment-là
    return Math.round(Math.max(Math.min(120, Math.max(m.room, 40)), Math.min(window.innerHeight * 0.35, m.room * 0.6)));
  };
  if (!pinned) gsap.set(word, { transformOrigin: '50% 100%' });
  const state = { k: 0 };
  const setGap = gsap.quickSetter(gaps, 'width', 'em');
  const setScaleX = gsap.quickSetter(word, 'scaleX');
  const setScaleY = gsap.quickSetter(word, 'scaleY');
  const setY = gsap.quickSetter(word, 'y', 'px');

  // k : 0 → 1. Les écarts se referment ; le mot, qui se resserre, grandit peu à peu
  // jusqu'à remplir la largeur du conteneur (jamais au-delà des marges ni de 74 %
  // de la hauteur de l'écran). Au départ, il garde sa taille.
  const apply = () => {
    if (!m) measure();
    const { k } = state;
    const gap = GAP - (GAP - GAP_END) * k;
    const width = m.fixed + gaps.length * gap * m.fs;
    const endWidth = m.fixed + gaps.length * GAP_END * m.fs;
    const maxScale = pinned
      ? (0.74 * window.innerHeight) / m.cap
      : Math.min((0.5 * window.innerHeight) / m.cap, 1 + Math.max(0, m.room - course()) / m.height);
    const endScale = Math.max(1, Math.min(m.stage / endWidth, maxScale));
    setGap(gap);
    const scale = Math.max(1, Math.min(m.stage / width, 1 + (endScale - 1) * k));
    setScaleX(scale);
    setScaleY(scale);
    setY(pinned ? (window.innerHeight / 2 - m.center) * k : 0);
  };
  applyNow = apply;
  ScrollTrigger.addEventListener('refresh', () => { measure(); apply(); });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: hero,
      // Mobile : dès le premier pixel de défilement
      start: pinned ? 'top top' : 0,
      end: () => `+=${course()}`,
      pin: pinned ? pin : false,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  // Ordinateur : le titre et le chapeau s'effacent, le mot prend la scène.
  // Mobile : ils défilent normalement avec la page.
  if (pinned) tl.to(fades, { opacity: 0, y: -32, duration: 0.3, stagger: 0.03 }, 0);
  // Les stickers se décollent l'un après l'autre, chacun de son côté
  photos.forEach((p, i) => {
    tl.to(p, { yPercent: -130, xPercent: i % 2 ? 30 : -30, rotation: `+=${i % 2 ? 26 : -26}`, scale: 0.5, opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.04 + i * 0.07);
  });
  gsap.set(mark, { opacity: 1, scaleX: 0, rotation: -1.5, transformOrigin: '0% 50%' });
  tl.to(state, { k: 1, duration: 0.94, ease: 'power2.inOut', onUpdate: apply }, 0.06)
    .to(mark, { scaleX: 1, duration: 0.3, ease: 'power2.out' }, 0.7);
  apply();
}

/* ---- Vision : la citation se corrige au scroll ---------------------------- */

function initVision() {
  const quote = $('[data-vision-quote]');
  if (!quote) return;
  const text = $('[data-vision-text]', quote);
  const strike = $('[data-vision-strike]', quote);
  const result = $('[data-vision-result]', quote);
  const [strikePath, swooshPath] = $$('[data-vision-draw]', quote);
  const markEl = $('.vision__mark', quote);
  // Mouvement réduit : état final du CSS (barré, souligné)
  if (!text || !strike || !result || isReduced) return;

  const ink = getComputedStyle(text).color;
  const muted = getComputedStyle(strike).color;

  gsap.timeline({ scrollTrigger: { trigger: quote, start: 'top 82%', once: true } })
    .from(markEl, { scale: 0.3, rotation: -30, opacity: 0, transformOrigin: '0% 100%', duration: 1, ease: 'back.out(2.2)' }, 0)
    .from(text, { opacity: 0, y: 44, duration: 1.2, ease: 'expo.out' }, 0.08);

  // « des livrables » se barre et s'éteint, puis « des résultats » se souligne au citron
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: text, start: 'top 72%', end: 'bottom 38%', scrub: 0.6 },
  })
    .fromTo(strikePath, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.42 }, 0)
    .fromTo(strike, { color: ink }, { color: muted, duration: 0.42 }, 0)
    .fromTo(swooshPath, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45 }, 0.55);
}

/* ---- Valeurs : cartes qui se retournent ----------------------------------- */

function initValues() {
  $$('[data-value]').forEach((card) => {
    const toggle = $('[data-value-toggle]', card);
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const flipped = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(flipped));
      card.classList.toggle('is-flipped', flipped);
    });
  });
}

/* ---- Trajectoire : la frise se remplit ------------------------------------ */

function initTimeline() {
  const section = $('[data-timeline]');
  if (!section) return;
  const track = $('[data-timeline-track]', section);
  const rail = $('.timeline__rail', section);
  const fill = $('[data-timeline-fill]', section);
  const tip = $('[data-timeline-tip]', section);
  const items = $$('[data-milestone]', section);
  const dots = items.map((item) => $('[data-milestone-dot]', item));
  const state = { p: 0 };
  let marks = [];

  const render = () => {
    const { p } = state;
    gsap.set(fill, { scaleY: p });
    gsap.set(tip, { y: p * rail.offsetHeight });
    items.forEach((item, i) => item.classList.toggle('is-active', p >= marks[i] - 0.002));
  };

  // Le rail relie le premier point au dernier (mesures de mise en page, sans transforms)
  const measure = () => {
    const centers = dots.map((dot, i) => items[i].offsetTop + dot.offsetTop + dot.offsetHeight / 2);
    const top = centers[0] || 0;
    const length = Math.max(1, (centers[centers.length - 1] || 0) - top);
    rail.style.top = `${top}px`;
    rail.style.bottom = 'auto';
    rail.style.height = `${length}px`;
    marks = centers.map((c) => (c - top) / length);
    if (!isReduced) render();
  };
  measure();
  new ResizeObserver(measure).observe(track);
  // Mouvement réduit : rail plein, toutes les dates allumées (CSS), rien de lié au scroll
  if (isReduced) return;
  root.classList.add('has-timeline');
  render();
  ScrollTrigger.addEventListener('refreshInit', measure);

  // La pointe suit la ligne des 60 % de l'écran : chaque date s'allume en la croisant
  gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: { trigger: rail, start: 'top 60%', end: 'bottom 60%', scrub: 0.5 },
  });

  items.forEach((item) => {
    gsap.from(item.children, {
      opacity: 0,
      y: 26,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.08,
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: item, start: 'top 88%', once: true },
    });
  });
}

export default function init() {
  [initHero, initVision, initValues, initTimeline].forEach((fn) => {
    try { fn(); } catch (err) { console.error('[GJS] à propos', err); }
  });
  ScrollTrigger.refresh();
}
