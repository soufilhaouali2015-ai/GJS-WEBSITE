/* ==========================================================================
   GJS · SYSTÈME D'ANIMATIONS (GSAP, piloté par attributs HTML)

   data-anim="lines"     titre révélé ligne par ligne au masque (SplitText)
   data-anim="chars"     lettres qui arrivent en vague
   data-anim="fade"      bloc qui monte en fondu
   data-anim="cascade"   les enfants directs arrivent en cascade
   data-anim="stick"     se colle comme un sticker (rotation qui se pose, rebond)
   data-anim="stamp"     effet tampon (échelle 1,6 → 1, petite secousse)
                           data-stamp-from="2.2"  échelle de départ
                           data-stamp-spin="5"    rotation de départ (degrés)
                           data-shake=".wrap"     bloc parent qui encaisse la secousse
   data-anim="marker"    trait de marqueur citron qui se dessine sous un .hl
   data-anim="photo"     photo révélée par un masque, avec un léger zoom arrière
   data-anim="svc-grid"  chorégraphie de la grille des services
   data-anim-delay="0.2" décalage en secondes

   Dans un titre « lines » ou « chars » :
   <span data-count="24">24</span>  nombre qui défile de 0 à sa valeur (la vraie
                                    valeur reste écrite dans le HTML) ;
   <span class="hl">mot</span>      le trait de marqueur se dessine après le titre.

   Déclenché une seule fois, à l'arrivée à l'écran. Le texte est soit absent,
   soit lisible à 100 % : jamais semi-transparent en attendant le scroll.
   Les blocs en attente sont masqués en opacité seulement : ils restent dans
   l'ordre de tabulation et lisibles par les lecteurs d'écran, et se révèlent
   aussitôt qu'ils reçoivent le focus clavier.
   Mouvement réduit : simples fondus de 0,4 s.
   ========================================================================== */

import { isReduced } from './profile.js';

const { gsap, ScrollTrigger, SplitText } = window;
const EASE = 'expo.out';
const START = 'top 86%';

const ready = (el) => el.classList.add('is-anim-ready');

/* Révélations en attente (élément → fonction), jouées une seule fois : à
   l'arrivée à l'écran, ou plus tôt si le focus clavier entre dans l'élément. */
const pending = new Map();

function arm(el, fn) {
  const run = (index = 0) => {
    if (!pending.has(el)) return;
    pending.delete(el);
    fn(index);
  };
  pending.set(el, run);
  return run;
}

function onEnter(el, fn, start = START) {
  const run = arm(el, fn);
  ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => run() });
}

function revealOnFocus(e) {
  for (let n = e.target; n && n !== document.body; n = n.parentElement) {
    const run = pending.get(n);
    if (run) run();
  }
}

/* ---- Compteurs et traits de marqueur contenus dans un titre découpé -------- */

function extras(el) {
  return {
    counts: [...el.querySelectorAll('[data-count]')],
    marks: [...el.querySelectorAll('.hl')],
  };
}

/** État de départ : le compteur affiche 0 (largeur finale réservée), le trait est replié. */
function primeExtras({ counts, marks }) {
  counts.forEach((c) => {
    c.style.minWidth = `${c.getBoundingClientRect().width}px`;
    c.textContent = '0';
  });
  marks.forEach((m) => m.classList.add('is-marker'));
}

/* Sur fond noir, le mot est écrit en noir sur le trait citron : il doit être lisible en 0,6 s */
const markDelay = (m) => (m.closest('.is-dark') ? 0.1 : 0.35);

function playExtras({ counts, marks }, delay) {
  counts.forEach((c) => {
    const to = parseFloat(c.dataset.count) || 0;
    const o = { v: 0 };
    gsap.to(o, {
      v: to,
      duration: 1.2,
      delay: delay + 0.15,
      ease: EASE,
      onUpdate: () => { c.textContent = String(Math.round(o.v)); },
      onComplete: () => { c.textContent = c.dataset.count; },
    });
  });
  marks.forEach((m) => gsap.delayedCall(delay + markDelay(m), () => m.classList.add('is-marked')));
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
      const x = extras(el);
      primeExtras(x);
      return gsap.from(self.lines, {
        yPercent: 118,
        rotation: 2,
        duration: 1.1,
        stagger: 0.08,
        ease: EASE,
        delay,
        scrollTrigger: { trigger: el, start: START, once: true, onEnter: () => { played = true; playExtras(x, delay); } },
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
      const x = extras(el);
      primeExtras(x);
      return gsap.from(self.chars, {
        yPercent: 120,
        rotation: 10,
        duration: 1,
        stagger: 0.06,
        ease: EASE,
        delay,
        scrollTrigger: { trigger: el, start: START, once: true, onEnter: () => { played = true; playExtras(x, delay + self.chars.length * 0.03); } },
      });
    },
  });
}

const fadeFrom = { opacity: 0, y: 48 };

function fade(el, delay) {
  gsap.set(el, fadeFrom);
  ready(el);
  onEnter(el, () => gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: EASE, delay }));
}

function cascade(el, delay) {
  const kids = [...el.children];
  gsap.set(kids, fadeFrom);
  ready(el);
  onEnter(el, () => gsap.to(kids, { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: EASE, delay }));
}

/** Un sticker qu'on colle : il arrive de travers, se pose et rebondit à peine. */
export function stickTimeline(el, { rotation = 0 } = {}) {
  return gsap.timeline()
    .fromTo(el, { opacity: 0, y: -36, rotation: rotation - 14, scale: 1.16 }, { opacity: 1, y: 6, rotation: rotation + 1.2, scale: 0.985, duration: 0.6, ease: EASE })
    .to(el, { y: 0, rotation, scale: 1, duration: 0.7, ease: EASE });
}

/** Un tampon : il s'écrase sur la surface, qui encaisse une petite secousse. */
export function stampTimeline(el, { rotation = 0, shake = el.parentElement, from = 1.6, spin = 16 } = {}) {
  const tl = gsap.timeline()
    .fromTo(el, { opacity: 0, scale: from, rotation: rotation - spin }, { opacity: 1, scale: 1, rotation, duration: 0.6, ease: EASE });
  if (shake) tl.fromTo(shake, { x: 0 }, { keyframes: { x: [-5, 4, -2, 1, 0] }, duration: 0.6, ease: EASE }, 0.18);
  return tl;
}

const baseRotation = (el) => Number(gsap.getProperty(el, 'rotation')) || 0;

function stick(el, delay) {
  const r = baseRotation(el);
  gsap.set(el, { opacity: 0 });
  ready(el);
  onEnter(el, () => stickTimeline(el, { rotation: r }).delay(delay));
}

function stamp(el, delay) {
  const r = baseRotation(el);
  const from = parseFloat(el.dataset.stampFrom) || 1.6;
  const spin = el.dataset.stampSpin !== undefined ? parseFloat(el.dataset.stampSpin) : 16;
  const shake = el.dataset.shake ? el.closest(el.dataset.shake) : el.parentElement;
  gsap.set(el, { opacity: 0 });
  ready(el);
  onEnter(el, () => stampTimeline(el, { rotation: r, shake, from, spin }).delay(delay));
}

/** Trait de marqueur seul (dans un paragraphe) : il se dessine à l'arrivée à l'écran. */
function marker(el, delay) {
  el.classList.add('is-marker');
  ready(el);
  onEnter(el, () => gsap.delayedCall(delay + markDelay(el), () => el.classList.add('is-marked')), 'top 90%');
}

/** Photo : le cadre reste en place, l'image monte derrière son masque en dézoomant. */
function photo(el, delay) {
  const img = el.querySelector('img, picture, svg') || el.firstElementChild;
  if (!img) { fade(el, delay); return; }
  gsap.set(img, { yPercent: 101, scale: 1.25, transformOrigin: '50% 100%' });
  ready(el);
  onEnter(el, () => gsap.to(img, { yPercent: 0, scale: 1, duration: 1.2, ease: EASE, delay }));
}

/** Grille des services : les 3 phares se collent l'un après l'autre, leur
    badge tombe en dernier en tampon ; les 6 autres arrivent en cascade. */
function svcGrid(el) {
  const featured = [...el.querySelectorAll('.svc-card--featured')];
  const others = [...el.querySelectorAll('.svc-card:not(.svc-card--featured)')];
  const label = el.querySelector('.svc-grid__label');
  const badges = new Map(featured.map((c) => [c, c.querySelector('.svc-card__badge')]));
  gsap.set(featured, { opacity: 0 });
  badges.forEach((b) => b && gsap.set(b, { opacity: 0 }));
  gsap.set(others, { opacity: 0, y: 70, rotation: 1.5 });
  if (label) gsap.set(label, fadeFrom);
  ready(el);

  featured.forEach((cardEl) => arm(cardEl, (i) => {
    const tl = stickTimeline(cardEl).delay(i * 0.1);
    const badge = badges.get(cardEl);
    if (badge) tl.add(stampTimeline(badge, { rotation: baseRotation(badge), shake: cardEl.querySelector('[data-tilt-body]') }), '-=0.45');
  }));
  others.forEach((cardEl) => arm(cardEl, (i) => {
    gsap.to(cardEl, { opacity: 1, y: 0, rotation: 0, duration: 1, delay: i * 0.08, ease: EASE });
  }));
  const play = (batch) => batch.forEach((cardEl, i) => { const run = pending.get(cardEl); if (run) run(i); });
  ScrollTrigger.batch(featured, { start: 'top 88%', once: true, onEnter: play });
  if (label) onEnter(label, () => gsap.to(label, { opacity: 1, y: 0, duration: 1, ease: EASE }), 'top 92%');
  ScrollTrigger.batch(others, { start: 'top 90%', once: true, onEnter: play });
}

// Sans SplitText (fichier bloqué ou non chargé), les titres arrivent en simple fondu
const TYPES = SplitText
  ? { lines, chars, fade, cascade, stick, stamp, marker, photo, 'svc-grid': svcGrid }
  : { lines: fade, chars: fade, fade, cascade, stick, stamp, marker, photo, 'svc-grid': svcGrid };

/* ---- Mouvement réduit : un simple fondu, partout ---------------------------- */

function reducedFade(el) {
  const targets = el.dataset.anim === 'svc-grid' ? [...el.children] : [el];
  gsap.set(targets, { opacity: 0 });
  ready(el);
  onEnter(el, () => gsap.to(targets, { opacity: 1, duration: 0.4, ease: 'power1.out' }), 'top 96%');
}

export function initMotion(root = document) {
  gsap.registerPlugin(...[ScrollTrigger, SplitText].filter(Boolean));
  root.querySelectorAll('[data-anim]').forEach((el) => {
    if (el.parentElement && el.parentElement.closest('[data-anim="svc-grid"]')) return;
    const delay = parseFloat(el.dataset.animDelay || '0') || 0;
    try {
      if (isReduced) reducedFade(el);
      else (TYPES[el.dataset.anim] || fade)(el, delay);
    } catch (err) {
      // Un bloc qui échoue reste affiché normalement, sans bloquer les suivants
      console.error('[GJS] animation', el, err);
      const parts = [el, ...el.children, ...el.querySelectorAll('.svc-card__badge')];
      parts.forEach((part) => pending.delete(part));
      gsap.set(parts, { clearProps: 'opacity,visibility,transform' });
      ready(el);
    }
  });
  document.addEventListener('focusin', revealOnFocus);
  // Impression avant d'avoir fait défiler : les compteurs affichent leur vraie valeur
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('[data-count]').forEach((c) => { c.textContent = c.dataset.count; });
  });
  window.__gjsMotion = true;
}
