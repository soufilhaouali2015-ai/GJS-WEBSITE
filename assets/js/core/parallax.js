/* ==========================================================================
   GJS · PARALLAXE SUR 3 PROFONDEURS ET TITRES QUI SE DÉFORMENT
   data-parallax="0.12 | 0.25 | 0.45"  décor (sticker, scotch, flèche) qui glisse
       à sa vitesse pendant le scroll et réagit un peu à la souris (ordinateur).
       Toujours décoratif (aria-hidden), placé hors des textes en CSS.
   data-skew  titre géant qui s'incline et s'étire selon la vitesse du scroll,
       puis revient en place avec le ressort commun.
   Mouvement réduit : rien de tout ça.
   ========================================================================== */

import { isDesktop, isReduced } from './profile.js';
import { scrollVelocity } from './scroll.js';
import { spring, SPRING } from './spring.js';

const { gsap } = window;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function parallax(root) {
  const decos = [...root.querySelectorAll('[data-parallax]')];
  if (!decos.length) return;
  const mx = spring(SPRING.soft, 0);
  const items = decos.map((el) => {
    const f = parseFloat(el.dataset.parallax) || 0.2;
    gsap.fromTo(el, { y: 180 * f }, {
      y: -180 * f,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    return { el, f, x: gsap.quickSetter(el, 'x', 'px'), r: gsap.quickSetter(el, 'rotation', 'deg'), base: Number(gsap.getProperty(el, 'rotation')) || 0 };
  });
  if (!isDesktop) return;
  // Réaction à la souris : un seul ressort pour tout le décor, les plus proches bougent plus
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') mx.set((e.clientX / window.innerWidth) * 2 - 1); }, { passive: true });
  let last = 0;
  gsap.ticker.add((t, dms) => {
    mx.step(Math.min(0.05, dms / 1000));
    if (Math.abs(mx.value - last) < 0.0005) return;
    last = mx.value;
    items.forEach((it) => { it.x(mx.value * it.f * 60); it.r(it.base + mx.value * it.f * 10); });
  });
}

function skew(root) {
  const titles = [...root.querySelectorAll('[data-skew]')];
  if (!titles.length) return;
  const setters = new Map(titles.map((el) => [el, { k: gsap.quickSetter(el, 'skewY', 'deg'), s: gsap.quickSetter(el, 'scaleY') }]));
  const max = isDesktop ? 6 : 3.5;
  const k = spring(SPRING.follow, 0);
  const apply = (el, v) => { const st = setters.get(el); st.k(v); st.s(1 + Math.abs(v) * 0.012); };
  const visible = new Set();
  // Un titre qui sort de l'écran reprend sa forme ; celui qui entre prend la déformation en cours
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { visible.add(e.target); apply(e.target, k.value); } else { visible.delete(e.target); apply(e.target, 0); }
  }));
  titles.forEach((el) => {
    gsap.set(el, { transformOrigin: '0% 50%' });
    io.observe(el);
  });
  let last = 0;
  gsap.ticker.add((t, dms) => {
    k.set(clamp(-scrollVelocity() * 0.22, -max, max));
    k.step(Math.min(0.05, dms / 1000));
    if (Math.abs(k.value - last) < 0.002) return;
    last = k.value;
    visible.forEach((el) => apply(el, k.value));
  });
}

export function initDepth(root = document) {
  if (isReduced) return;
  parallax(root);
  skew(root);
}
