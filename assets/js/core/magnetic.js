/* ==========================================================================
   GJS · BOUTONS
   Tous les .btn reçoivent :
     · un remplissage qui arrive depuis la gauche (citron, ou noir sur les
       boutons citron) ;
     · un texte qui « roule » : il sort par le haut, sa copie arrive par le bas ;
   Sur ordinateur, ils deviennent magnétiques : le bouton suit le curseur
   (ressort) et son texte se décale un peu plus, comme une couche en relief.
   ========================================================================== */

import { isDesktop, isReduced } from './profile.js';
import { spring, SPRING, run } from './spring.js';

const { gsap } = window;

function el(tag, cls) {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
}

function enhance(btn) {
  if (btn.dataset.btnReady) return;
  btn.dataset.btnReady = '1';
  const fill = el('span', 'btn__fill');
  fill.setAttribute('aria-hidden', 'true');
  // Le libellé du bouton d'envoi change en cours d'envoi : pas de copie à synchroniser
  const noRoll = btn.hasAttribute('data-form-submit') || btn.classList.contains('btn--no-roll');
  const visible = [...btn.childNodes].filter((n) => !(n.nodeType === 1 && n.classList.contains('sr-only')) && !(n.nodeType === 3 && !n.textContent.trim()));
  if (noRoll || !visible.length || isReduced) { btn.prepend(fill); return; }
  const label = el('span', 'btn__label');
  const text = el('span', 'btn__text');
  visible.forEach((n) => text.appendChild(n));
  const copy = text.cloneNode(true);
  copy.classList.add('btn__text--copy');
  copy.setAttribute('aria-hidden', 'true');
  copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  label.append(text, copy);
  btn.prepend(label);
  btn.prepend(fill);
}

function magnet(btn) {
  const label = btn.querySelector('.btn__label');
  const bx = spring(SPRING.follow);
  const by = spring(SPRING.follow);
  const lx = spring(SPRING.follow);
  const ly = spring(SPRING.follow);
  const setBX = gsap.quickSetter(btn, 'x', 'px');
  const setBY = gsap.quickSetter(btn, 'y', 'px');
  const setLX = label ? gsap.quickSetter(label, 'x', 'px') : null;
  const setLY = label ? gsap.quickSetter(label, 'y', 'px') : null;
  let active = false;
  let pressed = false;
  let stop = null;
  btn.classList.add('is-magnetic');

  const loop = (dt) => {
    [bx, by, lx, ly].forEach((s) => s.step(dt));
    setBX(bx.value);
    setBY(by.value);
    if (setLX) { setLX(lx.value); setLY(ly.value); }
    if (!active && [bx, by, lx, ly].every((s) => s.settled)) { stop = null; return false; }
    return true;
  };
  const start = () => { if (!stop) stop = run(loop); };

  // data-magnet="strong" (gros bouton rond) : il suit plus loin, son texte encore plus
  const f = btn.dataset.magnet === 'strong'
    ? { bx: 0.34, by: 0.34, lx: 0.24, ly: 0.24 }
    : { bx: 0.22, by: 0.32, lx: 0.1, ly: 0.12 };
  btn.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = btn.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const press = pressed ? 3 : -2;
    bx.set(dx * f.bx + press);
    by.set(dy * f.by + press);
    lx.set(dx * f.lx);
    ly.set(dy * f.ly);
    active = true;
    start();
  });
  btn.addEventListener('pointerdown', () => { pressed = true; bx.set(bx.target + 5); by.set(by.target + 5); start(); });
  btn.addEventListener('pointerup', () => { pressed = false; });
  btn.addEventListener('pointerleave', () => {
    active = false;
    pressed = false;
    [bx, by, lx, ly].forEach((s) => s.set(0));
    start();
  });
}

export function initButtons(root = document) {
  root.querySelectorAll('.btn').forEach((btn) => {
    enhance(btn);
    if (isDesktop) magnet(btn);
  });
}
