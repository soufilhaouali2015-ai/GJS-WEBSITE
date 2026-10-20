/* ==========================================================================
   GJS · INDEX TYPOGRAPHIQUE DES SERVICES (page Services)
   Les 9 noms en grand. Sur ordinateur, au survol d'un nom, son affiche
   apparaît et suit le curseur avec un léger retard (ressort commun), en
   pivotant selon la vitesse de la souris. Au clavier, l'affiche se pose à
   côté du lien qui a le focus. Les affiches ne se chargent qu'au premier
   survol de l'index. Mobile et mouvement réduit : liste simple.
   ========================================================================== */

import { isDesktop, isReduced } from '../core/profile.js';
import { spring, SPRING, run } from '../core/spring.js';

const { gsap } = window;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function initServicesIndex(root = document) {
  const list = root.querySelector('[data-svc-index]');
  if (!list || !isDesktop || isReduced) return;
  const links = [...list.querySelectorAll('.svc-index__link')];

  const frame = document.createElement('div');
  frame.className = 'svc-float';
  frame.setAttribute('aria-hidden', 'true');
  const imgs = links.map((a) => {
    const img = document.createElement('img');
    img.alt = '';
    img.width = 640;
    img.height = 800;
    img.decoding = 'async';
    img.className = 'svc-float__img';
    img.dataset.src = a.dataset.poster;
    frame.appendChild(img);
    return img;
  });
  document.body.appendChild(frame);

  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    imgs.forEach((img) => { img.src = img.dataset.src; });
  };

  const x = spring(SPRING.follow, window.innerWidth / 2);
  const y = spring(SPRING.follow, window.innerHeight / 2);
  const rot = spring(SPRING.soft, 0);
  const show = spring(SPRING.soft, 0);
  const setX = gsap.quickSetter(frame, 'x', 'px');
  const setY = gsap.quickSetter(frame, 'y', 'px');
  const setR = gsap.quickSetter(frame, 'rotation', 'deg');
  const setSX = gsap.quickSetter(frame, 'scaleX');
  const setSY = gsap.quickSetter(frame, 'scaleY');
  const setS = (v) => { setSX(v); setSY(v); };
  const setO = gsap.quickSetter(frame, 'opacity');
  let stop = null;
  let active = -1;
  let lastX = 0;
  let lastT = 0;

  const loop = (dt) => {
    [x, y, rot, show].forEach((s) => s.step(dt));
    rot.set(rot.target * 0.9); // la rotation retombe quand la souris ralentit
    setX(x.value);
    setY(y.value);
    setR(rot.value);
    setS(0.7 + 0.3 * show.value);
    setO(clamp(show.value, 0, 1));
    if (show.target === 0 && show.value < 0.01 && [x, y, rot].every((s) => s.settled)) { stop = null; return false; }
    return true;
  };
  const start = () => { if (!stop) stop = run(loop); };

  const pick = (i) => {
    if (i === active) return;
    active = i;
    imgs.forEach((img, k) => img.classList.toggle('is-active', k === i));
    list.classList.toggle('is-hovering', i >= 0);
    links.forEach((a, k) => a.classList.toggle('is-active', k === i));
  };

  list.addEventListener('pointerenter', load);
  list.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now();
    const vx = (e.clientX - lastX) / Math.max(8, now - lastT);
    lastX = e.clientX;
    lastT = now;
    // L'affiche se place au-dessus du curseur (en dessous près du haut de l'écran),
    // pour ne jamais cacher le nom survolé
    const h = frame.offsetHeight;
    const above = e.clientY - h - 28;
    x.set(Math.min(e.clientX + 24, window.innerWidth - frame.offsetWidth - 16));
    y.set(above > 8 ? above : e.clientY + 36);
    rot.set(clamp(vx * 9, -14, 14));
    const link = e.target.closest('.svc-index__link');
    if (link) { pick(links.indexOf(link)); show.set(1); }
    start();
  });
  list.addEventListener('pointerleave', () => { pick(-1); show.set(0); start(); });

  // Clavier : l'affiche se pose à droite du lien qui reçoit le focus
  list.addEventListener('focusin', (e) => {
    const link = e.target.closest('.svc-index__link');
    if (!link || !link.matches(':focus-visible')) return;
    load();
    const r = link.getBoundingClientRect();
    // Même règle qu'à la souris : au-dessus de la ligne (en dessous près du haut)
    const above = r.top - frame.offsetHeight - 16;
    x.jump(Math.min(r.left + r.width * 0.45, window.innerWidth - frame.offsetWidth - 24));
    y.jump(above > 8 ? above : r.bottom + 16);
    pick(links.indexOf(link));
    show.set(1);
    start();
  });
  list.addEventListener('focusout', (e) => {
    if (!list.contains(e.relatedTarget)) { pick(-1); show.set(0); start(); }
  });

  // Un clic sur un nom ouvre sa fiche : l'affiche s'efface
  list.addEventListener('click', () => { pick(-1); show.set(0); start(); });
  window.addEventListener('scroll', () => { if (active >= 0 && !list.matches(':hover')) { pick(-1); show.set(0); start(); } }, { passive: true });
}
