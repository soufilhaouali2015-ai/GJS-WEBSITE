/* ==========================================================================
   GJS · LA BORNE D'ARCADE (accueil)
   Trois cartouches à choisir (clic, toucher ou flèches du clavier), un écran
   en mode démo qui montre chaque jeu en mouvement et « change de chaîne »
   (l'image s'écrase en une ligne, puis la suivante s'ouvre), un pupitre et
   une fiche (règles, commandes, record, bouton « Jouer »).
   L'écran s'allume quand il arrive à l'écran ; la démo s'arrête hors champ,
   avec le bouton « Pause démo » et avec le bouton pause du hero.
   Les jeux eux-mêmes ne sont chargés qu'au clic sur « Jouer ».
   ========================================================================== */

import { isReduced } from '../core/profile.js';
import { isPaused, onPause } from '../core/pause.js';
import { store } from '../core/utils.js';

const { gsap } = window;

function showRecords(root) {
  root.querySelectorAll('[data-highscore]').forEach((el) => {
    const best = store.get(`gjs-arcade-${el.dataset.highscore}`);
    if (best && best.score !== undefined) el.textContent = best.label || String(best.score);
  });
}

export function initBorne(root = document) {
  const borne = root.querySelector('[data-borne]');
  if (!borne) return;
  const tabs = [...borne.querySelectorAll('[data-borne-tab]')];
  const panels = [...borne.querySelectorAll('[data-borne-panel]')];
  const scenes = [...borne.querySelectorAll('[data-borne-scene]')];
  const screen = borne.querySelector('[data-borne-screen]');
  const tube = borne.querySelector('[data-borne-tube]');
  const flash = borne.querySelector('[data-borne-flash]');
  const num = borne.querySelector('[data-borne-num]');
  const stick = borne.querySelector('[data-borne-stick]');
  const list = borne.querySelector('[data-borne-tabs]');
  const pauseBtn = borne.querySelector('[data-borne-pause]');
  const pauseLabel = borne.querySelector('[data-borne-pause-label]');
  const motion = !isReduced && Boolean(gsap);
  let current = Math.max(0, tabs.findIndex((t) => t.classList.contains('is-active')));
  let switching = null;
  let powered = false;
  let demoPaused = false;

  panels.forEach((p, i) => { p.hidden = i !== current; });
  borne.classList.add('is-enhanced');
  showRecords(borne);
  document.addEventListener('gjs:highscore', () => showRecords(borne));

  // Lancement d'un jeu : la coque et le jeu ne sont téléchargés qu'à ce moment-là
  borne.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-launch-game]');
    if (!btn) return;
    e.preventDefault();
    const { openGame } = await import('../games/arcade.js');
    openGame(btn.dataset.launchGame, btn);
  });

  // Démo en pause : bouton du pupitre, bouton pause du hero, hors champ
  const syncDemo = () => {
    const paused = demoPaused || isPaused();
    borne.classList.toggle('is-demo-paused', paused);
    if (pauseBtn) pauseBtn.setAttribute('aria-pressed', String(demoPaused));
    if (pauseLabel) pauseLabel.textContent = demoPaused ? 'Relancer la démo' : 'Pause démo';
  };
  if (pauseBtn) {
    if (isReduced) pauseBtn.hidden = true; // rien ne bouge : le bouton serait inutile
    pauseBtn.addEventListener('click', () => { demoPaused = !demoPaused; syncDemo(); });
  }
  onPause(syncDemo);
  syncDemo();

  // Allumage du tube à la première apparition
  const powerOn = () => {
    powered = true;
    if (!motion) return;
    gsap.timeline()
      .fromTo(tube, { scaleX: 0.03, scaleY: 0.006 }, { scaleX: 1, duration: 0.28, ease: 'power2.out' })
      .to(tube, { scaleY: 1, duration: 0.55, ease: 'expo.out' })
      .fromTo(flash, { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power2.out' }, 0.18)
      .set(tube, { clearProps: 'transform' });
  };
  if (motion) gsap.set(tube, { scaleX: 0.03, scaleY: 0.006 });
  new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    screen.classList.toggle('is-on', entry.isIntersecting);
    if (entry.isIntersecting && !powered) powerOn();
  }, { threshold: 0.3 }).observe(screen);

  // Changement de chaîne : l'image s'écrase en une ligne, puis la suivante s'ouvre
  const switchScene = (from, to) => {
    const a = scenes[from];
    const b = scenes[to];
    const swap = () => { a.classList.remove('is-active'); b.classList.add('is-active'); };
    if (!motion || !powered) { swap(); return; }
    if (switching) switching.progress(1);
    switching = gsap.timeline({ onComplete: () => { switching = null; } })
      .to(tube, { scaleY: 0.012, duration: 0.16, ease: 'power3.in' })
      .to(tube, { scaleX: 0.02, duration: 0.1, ease: 'power2.in' })
      .add(swap)
      .fromTo(flash, { opacity: 0.85 }, { opacity: 0, duration: 0.45, ease: 'power2.out' })
      .to(tube, { scaleX: 1, duration: 0.14, ease: 'power2.out' }, '<')
      .to(tube, { scaleY: 1, duration: 0.42, ease: 'expo.out' })
      .set(tube, { clearProps: 'transform' });
  };

  const select = (index, { focus = false } = {}) => {
    const next = (index + tabs.length) % tabs.length;
    if (focus) tabs[next].focus();
    if (next === current) return;
    const prev = current;
    current = next;
    tabs.forEach((t, i) => {
      const on = i === next;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, i) => {
      const on = i === next;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (num) num.textContent = String(next + 1).padStart(2, '0');
    switchScene(prev, next);
    if (!motion) return;
    // Le joystick suit le changement, la fiche du jeu arrive en cascade
    if (stick) {
      stick.style.setProperty('--tilt', `${next > prev ? 20 : -20}deg`);
      setTimeout(() => stick.style.setProperty('--tilt', '0deg'), 260);
    }
    gsap.from(panels[next].querySelectorAll('.borne__rules, .borne__meta, .borne__play'), {
      opacity: 0, y: 16, duration: 0.6, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity',
    });
  };

  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
  // Onglets : flèches, Début, Fin (activation au focus)
  list.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); select(current + step, { focus: true }); } else if (e.key === 'Home') { e.preventDefault(); select(0, { focus: true }); } else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, { focus: true }); }
  });
}
