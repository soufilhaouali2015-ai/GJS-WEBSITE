/* ==========================================================================
   GJS · CARROUSEL EN CYLINDRE (page Services)
     ordinateur : scène collante sur ~2,2 écrans ; les 9 cartes tournent autour
                  d'un cylindre au fil du scroll. La carte de face est nette,
                  les autres reculent et pâlissent (voile crème). Un clic, ou le
                  focus clavier, amène une carte au centre.
     mobile     : glissé horizontal (défilement natif aimanté), chaque carte
                  pivote un peu selon sa position
     réduit et sans JS : simple grille (CSS)
   Tout est en transform (et opacity pour le voile).
   ========================================================================== */

import { isDesktop, isReduced } from '../core/profile.js';
import { getLenis } from '../core/scroll.js';

const { gsap, ScrollTrigger } = window;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function cylinder(orbit, ring, cards) {
  const section = orbit.closest('section');
  const n = cards.length;
  const step = 360 / n;
  let radius = 0;
  let center = -1;

  const veils = cards.map((card) => {
    const v = document.createElement('span');
    v.className = 'orbit__veil';
    v.setAttribute('aria-hidden', 'true');
    card.appendChild(v);
    return gsap.quickSetter(v, 'opacity');
  });
  const setRing = gsap.quickSetter(ring, 'rotationY', 'deg');

  const layout = () => {
    const w = ring.offsetWidth;
    // Rayon pour que les cartes se touchent presque sur le cylindre
    radius = Math.round((w / 2) / Math.tan(Math.PI / n) + 28);
    gsap.set(ring, { xPercent: -50, yPercent: -50, z: -radius });
    // Ordre voulu : pivoter d'abord, puis pousser vers l'extérieur (GSAP ferait l'inverse)
    cards.forEach((card, i) => { card.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`; });
  };

  const render = (p) => {
    const angle = -p * step * (n - 1);
    setRing(angle);
    cards.forEach((card, i) => {
      let d = Math.abs(((i * step + angle) % 360 + 540) % 360 - 180); // écart à la face, en degrés
      d = clamp(d / 110, 0, 1);
      veils[i](d * 0.72);
    });
    const c = Math.round(p * (n - 1));
    if (c !== center) {
      center = c;
      cards.forEach((card, i) => card.classList.toggle('is-center', i === c));
    }
  };

  layout();
  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => render(self.progress),
    onRefresh: (self) => { layout(); render(self.progress); },
  });
  render(0);

  // Amener une carte au centre : on fait défiler jusqu'à sa position
  const goTo = (i) => {
    const y = st.start + (i / (n - 1)) * (st.end - st.start);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  };
  cards.forEach((card, i) => {
    card.addEventListener('click', (e) => {
      if (card.classList.contains('is-center')) return; // la carte de face : son lien marche normalement
      e.preventDefault();
      goTo(i);
    });
    card.addEventListener('focusin', () => { if (!card.classList.contains('is-center')) goTo(i); });
  });
}

function swipe(ring, cards) {
  const setters = cards.map((card) => {
    const sx = gsap.quickSetter(card, 'scaleX');
    const sy = gsap.quickSetter(card, 'scaleY');
    return { r: gsap.quickSetter(card, 'rotationY', 'deg'), s: (v) => { sx(v); sy(v); } };
  });
  cards.forEach((card) => gsap.set(card, { transformPerspective: 900 }));
  let queued = false;
  const update = () => {
    queued = false;
    const mid = ring.scrollLeft + ring.clientWidth / 2;
    const offs = cards.map((card) => (card.offsetLeft + card.offsetWidth / 2 - mid) / card.offsetWidth);
    offs.forEach((o, i) => {
      const c = clamp(o, -1.5, 1.5);
      setters[i].r(-c * 24);
      setters[i].s(1 - Math.min(Math.abs(c), 1) * 0.08);
    });
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  ring.addEventListener('scroll', queue, { passive: true });
  new ResizeObserver(queue).observe(ring);
  update();
}

export function initCarousel(root = document) {
  const orbit = root.querySelector('[data-carousel]');
  if (!orbit || isReduced) return;
  const ring = orbit.querySelector('[data-orbit-ring]');
  const cards = [...orbit.querySelectorAll('[data-orbit-card]')];
  if (!ring || !cards.length) return;
  // La mise en page (cylindre ou glissé) est choisie en CSS selon le profil
  if (isDesktop && getComputedStyle(orbit.closest('section').querySelector('.svc-orbit__stage')).position === 'sticky') {
    orbit.classList.add('is-3d');
    cylinder(orbit, ring, cards);
  } else if (!isDesktop) {
    orbit.classList.add('is-swipe');
    swipe(ring, cards);
  }
}
