/* ==========================================================================
   GJS · BANDEAU DÉFILANT (deux rangées, entre le hero et les services)
   <section class="marquees" data-marquees>
     <div class="marquee" data-marquee data-speed="70" data-direction="-1">
       <div class="marquee__track"><div class="marquee__group">…</div></div>
     </div>
   </section>
   La vitesse et le sens suivent la vitesse du scroll ; un léger skew accompagne
   les accélérations. Pause automatique hors écran, au survol et au focus, avec
   le bouton pause du hero, et bouton pause / lecture propre au bandeau
   (WCAG 2.2.2 : tout ce qui défile plus de 5 s doit pouvoir être arrêté).
   Mouvement réduit : les rangées restent immobiles.
   ========================================================================== */

import { isReduced } from './profile.js';
import { scrollVelocity, scrollDirection } from './scroll.js';
import { isPaused } from './pause.js';

const { gsap } = window;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Lissage indépendant du nombre d'images par seconde
const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt);

const PAUSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.5" y="3" width="3" height="10" rx="0.5"/><rect x="9.5" y="3" width="3" height="10" rx="0.5"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z"/></svg>';

// Duplique le groupe jusqu'à couvrir deux fois la largeur visible (boucle sans couture)
function fill(row) {
  const track = row.querySelector('.marquee__track');
  const group = row.querySelector('.marquee__group');
  track.querySelectorAll('[data-clone]').forEach((c) => c.remove());
  const width = group.getBoundingClientRect().width || 1;
  const needed = Math.ceil((row.offsetWidth * 2) / width) + 1;
  for (let i = 0; i < needed; i += 1) {
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.dataset.clone = '';
    track.appendChild(clone);
  }
  return width;
}

export function initMarquees(root = document) {
  const section = root.querySelector('[data-marquees]');
  if (!section) return;
  const rows = [...section.querySelectorAll('[data-marquee]')].map((el) => ({
    el,
    track: el.querySelector('.marquee__track'),
    group: el.querySelector('.marquee__group'),
    base: parseFloat(el.dataset.speed || '70'),
    baseDir: parseFloat(el.dataset.direction || '-1'),
    width: 1,
    x: 0,
    skew: 0,
    boost: 0,
    dir: 1,
  })).filter((r) => r.track && r.group);
  if (!rows.length) return;
  rows.forEach((r) => { r.width = fill(r.el); });
  if (isReduced) return;

  // Bouton pause / lecture, sur la marge droite du contenu
  let paused = false;
  let hovered = false;
  let visible = false;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'marquee__toggle';
  const render = () => {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement');
    toggle.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  };
  render();
  section.appendChild(toggle);
  toggle.addEventListener('click', () => { paused = !paused; render(); });
  section.addEventListener('pointerenter', () => { hovered = true; });
  section.addEventListener('pointerleave', () => { hovered = false; });
  section.addEventListener('focusin', () => { hovered = true; });
  section.addEventListener('focusout', () => { hovered = false; });

  // La police ou la largeur changent : on recalcule les copies
  const ro = new ResizeObserver(() => rows.forEach((r) => { r.width = fill(r.el); }));
  rows.forEach((r) => { ro.observe(r.el); ro.observe(r.group); });
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; }, { rootMargin: '100px' }).observe(section);

  rows.forEach((r) => {
    r.setX = gsap.quickSetter(r.track, 'x', 'px');
    r.setSkew = gsap.quickSetter(r.track, 'skewX', 'deg');
  });

  gsap.ticker.add((time, deltaMs) => {
    if (!visible || paused || hovered || isPaused()) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const v = scrollVelocity();
    rows.forEach((r) => {
      // Le sens s'inverse quand on remonte la page
      if (Math.abs(v) > 0.4) r.dir = scrollDirection() >= 0 ? 1 : -1;
      r.boost += (Math.abs(v) * 0.09 - r.boost) * damp(6, dt);
      const speed = r.base * (1 + clamp(r.boost, 0, 6));
      r.x += r.baseDir * r.dir * speed * dt;
      if (r.x <= -r.width) r.x += r.width;
      if (r.x > 0) r.x -= r.width;
      const target = clamp(-v * 0.35 * r.baseDir, -9, 9);
      r.skew += (target - r.skew) * damp(8, dt);
      r.setX(r.x);
      r.setSkew(r.skew);
    });
  });
}
