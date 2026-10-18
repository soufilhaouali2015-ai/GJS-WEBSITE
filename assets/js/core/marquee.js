/* ==========================================================================
   GJS · DOUBLE BANDEAU
   Deux bandes croisées défilent en sens inverse. Leur vitesse augmente avec
   celle du scroll et leur sens suit le sens du scroll (avec un ressort, pour
   que le demi-tour se fasse en douceur). Pause au survol et avec le bouton
   pause global. Rien ne bouge en mouvement réduit.
   ========================================================================== */

import { isReduced } from './profile.js';
import { scrollVelocity, scrollDirection } from './scroll.js';
import { isPaused } from './pause.js';
import { spring, SPRING } from './spring.js';

const { gsap } = window;

function setupBand(band) {
  const track = band.querySelector('[data-band-track]');
  const group = track && track.firstElementChild;
  if (!group) return;
  const base = parseFloat(band.dataset.speed) || 60;
  const dir = parseFloat(band.dataset.dir) || -1;
  const speed = spring(SPRING.soft, 1);
  const sense = spring(SPRING.soft, 1);
  const setX = gsap.quickSetter(track, 'x', 'px');
  let width = 0;
  let x = 0;
  let visible = false;
  let hover = false;

  const fill = () => {
    while (track.children.length > 1) track.lastElementChild.remove();
    width = group.getBoundingClientRect().width;
    const need = band.getBoundingClientRect().width + width;
    let total = width;
    while (total < need + width && track.children.length < 12) {
      const copy = group.cloneNode(true);
      track.appendChild(copy);
      total += width;
    }
  };
  fill();
  new ResizeObserver(fill).observe(band);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(band);
  band.addEventListener('pointerenter', () => { hover = true; });
  band.addEventListener('pointerleave', () => { hover = false; });

  gsap.ticker.add((time, dms) => {
    if (!visible || !width) return;
    const dt = Math.min(0.05, dms / 1000);
    const boost = Math.min(Math.abs(scrollVelocity()) * 0.16, 7);
    speed.set(isPaused() || hover ? 0 : 1 + boost);
    sense.set(scrollDirection());
    speed.step(dt);
    sense.step(dt);
    x += base * speed.value * sense.value * dir * dt;
    x = ((x % width) + width) % width;
    setX(-x);
  });
}

export function initBands(root = document) {
  if (isReduced) return;
  root.querySelectorAll('[data-band]').forEach(setupBand);
}
