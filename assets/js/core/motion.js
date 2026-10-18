/* ==========================================================================
   GJS · SYSTÈME D'ANIMATIONS (GSAP, piloté par attributs HTML)

   data-anim="lines"     titre révélé ligne par ligne au masque (SplitText)
   data-anim="chars"     lettres qui arrivent en vague
   data-anim="fade"      bloc qui monte en fondu
   data-anim="cascade"   les enfants directs arrivent en cascade
   data-anim="stick"     se colle comme un sticker (rotation qui se pose, rebond)
   data-anim="stamp"     effet tampon (échelle 1,6 → 1, petite secousse)
   data-anim="svc-grid"  chorégraphie de la grille des services
   data-anim-delay="0.2" décalage en secondes

   Déclenché une seule fois, à l'arrivée à l'écran. Le texte est soit absent,
   soit lisible à 100 % : jamais semi-transparent en attendant le scroll.
   Mouvement réduit : simples fondus de 0,4 s.
   ========================================================================== */

import { isReduced } from './profile.js';

const { gsap, ScrollTrigger, SplitText } = window;
const EASE = 'expo.out';
const START = 'top 86%';

const ready = (el) => el.classList.add('is-anim-ready');

function onEnter(el, fn, start = START) {
  ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn });
}

/* ---- Briques ---------------------------------------------------------------- */

function lines(el, delay) {
  let played = false;
  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'anim-line',
    autoSplit: true,
    aria: 'auto',
    onSplit(self) {
      ready(el);
      if (played) return undefined;
      return gsap.from(self.lines, {
        yPercent: 118,
        rotation: 2,
        duration: 1.1,
        stagger: 0.08,
        ease: EASE,
        delay,
        scrollTrigger: { trigger: el, start: START, once: true, onEnter: () => { played = true; } },
      });
    },
  });
}

function chars(el, delay) {
  let played = false;
  SplitText.create(el, {
    type: 'words,chars',
    mask: 'chars',
    charsClass: 'anim-char',
    autoSplit: true,
    aria: 'auto',
    onSplit(self) {
      ready(el);
      if (played) return undefined;
      return gsap.from(self.chars, {
        yPercent: 120,
        rotation: 10,
        duration: 1,
        stagger: 0.06,
        ease: EASE,
        delay,
        scrollTrigger: { trigger: el, start: START, once: true, onEnter: () => { played = true; } },
      });
    },
  });
}

const fadeFrom = { autoAlpha: 0, y: 48 };

function fade(el, delay) {
  gsap.set(el, fadeFrom);
  ready(el);
  onEnter(el, () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1, ease: EASE, delay }));
}

function cascade(el, delay) {
  const kids = [...el.children];
  gsap.set(kids, fadeFrom);
  ready(el);
  onEnter(el, () => gsap.to(kids, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: EASE, delay }));
}

/** Un sticker qu'on colle : il arrive de travers, se pose et rebondit à peine. */
export function stickTimeline(el, { rotation = 0 } = {}) {
  return gsap.timeline()
    .fromTo(el, { autoAlpha: 0, y: -36, rotation: rotation - 14, scale: 1.16 }, { autoAlpha: 1, y: 6, rotation: rotation + 1.2, scale: 0.985, duration: 0.6, ease: EASE })
    .to(el, { y: 0, rotation, scale: 1, duration: 0.7, ease: EASE });
}

/** Un tampon : il s'écrase sur la surface, qui encaisse une petite secousse. */
export function stampTimeline(el, { rotation = 0, shake = el.parentElement } = {}) {
  const tl = gsap.timeline()
    .fromTo(el, { autoAlpha: 0, scale: 1.6, rotation: rotation - 16 }, { autoAlpha: 1, scale: 1, rotation, duration: 0.6, ease: EASE });
  if (shake) tl.fromTo(shake, { x: 0 }, { keyframes: { x: [-5, 4, -2, 1, 0] }, duration: 0.6, ease: 'power2.out' }, 0.18);
  return tl;
}

const baseRotation = (el) => Number(gsap.getProperty(el, 'rotation')) || 0;

function stick(el, delay) {
  const r = baseRotation(el);
  gsap.set(el, { autoAlpha: 0 });
  ready(el);
  onEnter(el, () => stickTimeline(el, { rotation: r }).delay(delay));
}

function stamp(el, delay) {
  const r = baseRotation(el);
  gsap.set(el, { autoAlpha: 0 });
  ready(el);
  onEnter(el, () => stampTimeline(el, { rotation: r }).delay(delay));
}

/** Grille des services : les 3 phares se collent l'un après l'autre, leur
    badge tombe en dernier en tampon ; les 6 autres arrivent en cascade. */
function svcGrid(el) {
  const featured = [...el.querySelectorAll('.svc-card--featured')];
  const others = [...el.querySelectorAll('.svc-card:not(.svc-card--featured)')];
  const label = el.querySelector('.svc-grid__label');
  const badges = new Map(featured.map((c) => [c, c.querySelector('.svc-card__badge')]));
  gsap.set(featured, { autoAlpha: 0 });
  badges.forEach((b) => b && gsap.set(b, { autoAlpha: 0 }));
  gsap.set(others, { autoAlpha: 0, y: 70, rotation: 1.5 });
  if (label) gsap.set(label, fadeFrom);
  ready(el);

  ScrollTrigger.batch(featured, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => batch.forEach((cardEl, i) => {
      const tl = stickTimeline(cardEl).delay(i * 0.14);
      const badge = badges.get(cardEl);
      if (badge) tl.add(stampTimeline(badge, { rotation: baseRotation(badge), shake: cardEl.querySelector('[data-tilt-body]') }), '-=0.45');
    }),
  });
  if (label) onEnter(label, () => gsap.to(label, { autoAlpha: 1, y: 0, duration: 1, ease: EASE }), 'top 92%');
  ScrollTrigger.batch(others, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, rotation: 0, duration: 1, stagger: 0.08, ease: EASE }),
  });
}

const TYPES = { lines, chars, fade, cascade, stick, stamp, 'svc-grid': svcGrid };

/* ---- Mouvement réduit : un simple fondu, partout ---------------------------- */

function reducedFade(el) {
  const targets = el.dataset.anim === 'svc-grid' ? [...el.children] : [el];
  gsap.set(targets, { autoAlpha: 0 });
  ready(el);
  onEnter(el, () => gsap.to(targets, { autoAlpha: 1, duration: 0.4, ease: 'power1.out' }), 'top 96%');
}

export function initMotion(root = document) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  root.querySelectorAll('[data-anim]').forEach((el) => {
    if (el.parentElement && el.parentElement.closest('[data-anim="svc-grid"]')) return;
    const delay = parseFloat(el.dataset.animDelay || '0') || 0;
    if (isReduced) { reducedFade(el); return; }
    const fn = TYPES[el.dataset.anim] || fade;
    fn(el, delay);
  });
  window.__gjsMotion = true;
}
