/* ==========================================================================
   GJS · CARTES 3D
   [data-tilt="12"]   la carte pivote en X/Y selon le curseur (jusqu'à N°),
                      perspective 1000 px, retour en place par ressort.
   [data-depth="40"]  couche qui se détache en translateZ au survol (px).
   Reflet crème qui glisse comme sur une carte holographique ; l'ombre dure
   (calque séparé) se décale dans le sens opposé.
   [data-flip]        carte phare : se retourne au survol (ordinateur, avec
                      intention de 140 ms), au toucher (mobile), au clavier
                      (focus sur le verso) ou via [data-flip-toggle].
   Ordinateur : souris. Mobile : inclinaison sous le doigt. Réduit : rien.
   ========================================================================== */

import { isDesktop, isReduced } from './profile.js';
import { spring, SPRING, run } from './spring.js';

const { gsap } = window;

function setupTilt(cardEl) {
  const max = parseFloat(cardEl.dataset.tilt) || 12;
  const body = cardEl.querySelector('[data-tilt-body]') || cardEl;
  const shadow = cardEl.querySelector('.svc-card__shadow, [data-tilt-shadow]');
  const layers = [...cardEl.querySelectorAll('[data-depth]')].map((el) => ({
    depth: parseFloat(el.dataset.depth) || 0,
    set: gsap.quickSetter(el, 'z', 'px'),
  }));

  const glare = document.createElement('span');
  glare.className = 'tilt-glare';
  glare.setAttribute('aria-hidden', 'true');
  body.appendChild(glare);

  cardEl.classList.add('is-tiltable');

  const rx = spring(SPRING.follow);
  const ry = spring(SPRING.follow);
  const lift = spring(SPRING.soft);
  const gx = spring(SPRING.follow, 0.5);
  const gy = spring(SPRING.follow, 0.5);
  const all = [rx, ry, lift, gx, gy];

  const setRX = gsap.quickSetter(body, 'rotationX', 'deg');
  const setRY = gsap.quickSetter(body, 'rotationY', 'deg');
  const setSX = shadow ? gsap.quickSetter(shadow, 'x', 'px') : null;
  const setSY = shadow ? gsap.quickSetter(shadow, 'y', 'px') : null;
  const setGlare = gsap.quickSetter(glare, 'opacity');

  let active = false;
  let stop = null;

  const loop = (dt) => {
    all.forEach((s) => s.step(dt));
    setRX(rx.value);
    setRY(ry.value);
    layers.forEach((l) => l.set(l.depth * lift.value));
    if (setSX) {
      // L'ombre glisse à l'opposé de l'inclinaison (lumière fixe en haut à gauche)
      setSX(6 - ry.value * 0.9);
      setSY(6 + rx.value * 0.9);
    }
    setGlare(lift.value * 0.9);
    // Le reflet (2 fois la taille de la carte) centre son halo sous le pointeur
    glare.style.setProperty('--gx', `${(gx.value - 0.5) * 50}%`);
    glare.style.setProperty('--gy', `${(gy.value - 0.5) * 50}%`);
    if (!active && all.every((s) => s.settled)) { stop = null; return false; }
    return true;
  };

  const start = () => { if (!stop) stop = run(loop); };

  const move = (x, y) => {
    const r = cardEl.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (x - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (y - r.top) / r.height));
    ry.set((px - 0.5) * 2 * max);
    rx.set(-(py - 0.5) * 2 * max);
    gx.set(px);
    gy.set(py);
    lift.set(1);
    active = true;
    start();
  };

  const leave = () => {
    active = false;
    rx.set(0);
    ry.set(0);
    lift.set(0);
    start();
  };

  if (isDesktop) {
    cardEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY); });
    cardEl.addEventListener('pointerleave', leave);
  } else {
    // Mobile : la carte s'incline sous le doigt ; le navigateur reprend la main dès qu'on défile
    cardEl.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') move(e.clientX, e.clientY); });
    cardEl.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && active) move(e.clientX, e.clientY); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => cardEl.addEventListener(t, leave));
  }
}

function setupFlip(cardEl) {
  const toggle = cardEl.querySelector('[data-flip-toggle]');
  const back = cardEl.querySelector('.svc-card__face--back');
  cardEl.classList.add('is-flippable');
  let timer = 0;
  let e2kb = false; // dernière interaction au clavier

  const set = (on) => {
    cardEl.classList.toggle('is-flipped', on);
    if (toggle) toggle.setAttribute('aria-expanded', String(on));
  };

  if (isDesktop) {
    let dismissed = false; // Échap pendant le survol : le recto reste jusqu'à la sortie
    cardEl.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || dismissed) return;
      clearTimeout(timer);
      timer = setTimeout(() => set(true), 140);
    });
    cardEl.addEventListener('pointerleave', () => {
      dismissed = false;
      clearTimeout(timer);
      timer = setTimeout(() => set(false), 160);
    });
    // WCAG 1.4.13 : le verso montré au survol se referme avec Échap, sans bouger la souris
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !cardEl.matches(':hover') || cardEl.contains(document.activeElement)) return;
      clearTimeout(timer);
      dismissed = true;
      set(false);
    });
  } else {
    // Toucher la carte (hors lien ou bouton) la retourne
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      set(!cardEl.classList.contains('is-flipped'));
    });
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      const on = !cardEl.classList.contains('is-flipped');
      set(on);
      if (on && e2kb) {
        const first = back.querySelector('a, button');
        if (first) first.focus({ preventScroll: true });
      }
    });
  }

  // Clavier : le verso se montre dès que le focus y entre ; Échap revient au recto
  cardEl.addEventListener('keydown', (e) => {
    e2kb = true;
    if (e.key === 'Escape' && cardEl.classList.contains('is-flipped')) {
      set(false);
      if (toggle) toggle.focus({ preventScroll: true });
    }
  });
  cardEl.addEventListener('pointerdown', () => { e2kb = false; });
  cardEl.addEventListener('focusin', (e) => { if (back.contains(e.target)) set(true); });
  cardEl.addEventListener('focusout', (e) => {
    if (!cardEl.contains(e.relatedTarget)) set(false);
    else if (!back.contains(e.relatedTarget)) set(false);
  });
}

export function initTilt(root = document) {
  if (isReduced) return;
  root.querySelectorAll('[data-flip]').forEach(setupFlip);
  root.querySelectorAll('[data-tilt]').forEach(setupTilt);
}
