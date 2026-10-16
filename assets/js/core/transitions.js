/* ==========================================================================
   GJS — TRANSITION DE PAGE
   Un rideau bleu nuit monte, un mini vaisseau le traverse en dévoilant le nom
   de la page suivante dans son sillage, puis le rideau sort par le haut.
   Mouvement réduit : fondu court, sans vaisseau.
   ========================================================================== */

import { env, clamp } from './utils.js';

const { gsap } = window;

const NAMES = {
  '': 'Accueil',
  index: 'Accueil',
  offres: 'Nos offres',
  'a-propos': 'Qui sommes-nous',
  contact: 'Contact',
  'mentions-legales': 'Mentions légales',
  'politique-confidentialite': 'Confidentialité',
};

export function pageSlug(path = '') {
  const last = path.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop() || '';
  return last.replace(/\.html?$/, '');
}

export function pageName(path) {
  const slug = pageSlug(path);
  return NAMES[slug] ?? 'Hors trajectoire';
}

let root;
let curtain;
let content;
let nameFill;
let nameGhost;
let nameBox;
let pathLabel;
let ship;

export function initTransition() {
  root = document.querySelector('.page-transition');
  if (!root) return;
  curtain = root.querySelector('.page-transition__curtain');
  content = root.querySelector('.page-transition__content');
  nameFill = root.querySelector('[data-transition-name]');
  nameGhost = root.querySelector('[data-transition-ghost]');
  nameBox = root.querySelector('.page-transition__name');
  pathLabel = root.querySelector('[data-transition-path]');
  ship = root.querySelector('.page-transition__ship');
  // État initial posé par GSAP (un transform CSS serait additionné à yPercent)
  gsap.set(root, { autoAlpha: 0 });
  gsap.set([curtain, content], { yPercent: 100 });
}

/** Couvre l'écran. Résout quand la page courante est totalement masquée. */
export function curtainIn(path) {
  if (!root) return Promise.resolve();
  const name = pageName(path);
  nameFill.textContent = name;
  nameGhost.textContent = name;
  pathLabel.textContent = `/${pageSlug(path) || 'accueil'}`;
  nameFill.style.setProperty('--reveal', env.reducedMotion ? '130%' : '-10%');

  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    if (env.reducedMotion) {
      gsap.set([curtain, content], { yPercent: 0 });
      gsap.set(ship, { autoAlpha: 0 });
      tl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'none' });
      return;
    }
    const pose = { p: 0 };
    const w = window.innerWidth;
    const shipW = ship.offsetWidth || 120;
    const update = () => {
      const x = -shipW * 1.2 + pose.p * (w + shipW * 2.4);
      const y = Math.sin(pose.p * Math.PI * 2) * 18;
      const angle = Math.cos(pose.p * Math.PI * 2) * 6;
      gsap.set(ship, { x, y, rotation: angle });
      const box = nameBox.getBoundingClientRect();
      const tail = x + shipW * 0.15;
      const reveal = box.width ? ((tail - box.left) / box.width) * 100 : 0;
      nameFill.style.setProperty('--reveal', `${clamp(reveal, -10, 130)}%`);
    };

    gsap.set(root, { autoAlpha: 1 });
    gsap.set(ship, { autoAlpha: 1, x: -shipW * 2 });
    tl.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'expo.inOut' }, 0)
      .fromTo(content, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'expo.inOut' }, 0)
      .to(pose, { p: 1, duration: 0.85, ease: 'power1.inOut', onUpdate: update }, 0.22);
  });
}

/** Découvre la nouvelle page. onReveal est appelé dès que le rideau commence à sortir. */
export function curtainOut(onReveal) {
  if (!root) { if (onReveal) onReveal(); return Promise.resolve(); }
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(root, { autoAlpha: 0 });
        gsap.set([curtain, content], { yPercent: 100 });
        resolve();
      },
    });
    if (env.reducedMotion) {
      tl.add(() => onReveal && onReveal(), 0).to(root, { autoAlpha: 0, duration: 0.3, ease: 'none' }, 0);
      return;
    }
    tl.to([curtain, content], { yPercent: -100, duration: 0.7, ease: 'expo.inOut' }, 0.05)
      .add(() => onReveal && onReveal(), 0.3);
  });
}
