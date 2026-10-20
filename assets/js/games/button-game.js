/* ==========================================================================
   GJS ARCADE · JEU 1 : « Quelle est la meilleure agence digitale ? »
   Le bouton « Les autres agences » est incliquable : il fuit le curseur
   (il se replace dans une zone sûre), rétrécit et change de texte à chaque
   tentative. Au toucher, il bouge dès qu'on le touche ; au clavier, il
   s'échappe dès qu'il reçoit le focus et le renvoie vers GJS (annonce).
   Clic sur GJS : explosion de confettis, le bouton devient le message.
   ========================================================================== */

import { createLoop, createCanvas, createParticles, saveBest, PALETTE } from './utils.js';

const { gsap } = window;

const TEXTS = ['Les autres agences', 'Non.', 'Vraiment ?', 'Toujours pas', 'Abandonnez', 'Même pas en rêve', 'Raté', 'Presque…', 'Toujours non', 'Allez, GJS'];

export function create(api) {
  const { stage, sound } = api;
  stage.innerHTML = `
    <div class="bg-game">
      <p class="bg-game__q">Quelle est la meilleure <span class="hl">agence digitale</span> ?</p>
      <div class="bg-game__zone" data-zone>
        <button class="bg-game__gjs" type="button" data-gjs>GJS</button>
        <button class="bg-game__other" type="button" data-other>Les autres agences</button>
      </div>
      <p class="bg-game__count">Tentatives : <span data-count>0</span></p>
    </div>`;

  const zone = stage.querySelector('[data-zone]');
  const gjs = stage.querySelector('[data-gjs]');
  const other = stage.querySelector('[data-other]');
  const count = stage.querySelector('[data-count]');
  const fx = createCanvas(stage, 'bg-game__fx');
  const particles = createParticles();
  const loop = createLoop((dt) => {
    particles.update(dt);
    if (!particles.count) loop.stop();
  }, () => {
    fx.ctx.clearRect(0, 0, fx.size.w, fx.size.h);
    particles.render(fx.ctx);
  });

  let attempts = 0;
  let running = false;
  let done = false;
  let scale = 1;
  let cooldown = 0;
  let endTimer = 0;

  const place = (x, y) => {
    other.style.left = `${x}px`;
    other.style.top = `${y}px`;
  };

  // Position initiale : à droite de GJS
  const initial = () => {
    const z = zone.getBoundingClientRect();
    const o = other.getBoundingClientRect();
    place(Math.min(z.width - o.width - 8, z.width * 0.66), z.height * 0.5 - o.height / 2);
  };

  /** Replace le bouton loin du pointeur (px, py en coordonnées écran). */
  const flee = (px, py) => {
    const now = performance.now();
    if (done || now - cooldown < 60) return;
    cooldown = now;
    attempts += 1;
    count.textContent = String(attempts);
    other.textContent = TEXTS[Math.min(attempts, TEXTS.length - 1)];
    scale = Math.max(0.45, scale * 0.9);
    const z = zone.getBoundingClientRect();
    const o = other.getBoundingClientRect();
    const g = gjs.getBoundingClientRect();
    const current = Number(gsap.getProperty(other, 'scale')) || 1;
    const w = o.width / current;
    const h = o.height / current;
    let best = null;
    for (let i = 0; i < 40; i += 1) {
      const x = 8 + Math.random() * Math.max(1, z.width - w - 16);
      const y = 8 + Math.random() * Math.max(1, z.height - h - 16);
      const cx = z.left + x + w / 2;
      const cy = z.top + y + h / 2;
      const far = Math.hypot(cx - px, cy - py);
      const overlap = !(z.left + x > g.right + 24 || z.left + x + w < g.left - 24 || z.top + y > g.bottom + 24 || z.top + y + h < g.top - 24);
      if (overlap) continue;
      if (!best || far > best.far) best = { x, y, far };
      if (far > 260) break;
    }
    if (best) place(best.x, best.y);
    gsap.fromTo(other, { scale: 0, rotation: -12 }, { scale, rotation: (Math.random() - 0.5) * 8, duration: api.reduced ? 0 : 0.28, ease: 'back.out(2)', overwrite: true });
    sound.blip();
    if (attempts % 3 === 1) api.live(`Le bouton s’enfuit (${attempts} tentative${attempts > 1 ? 's' : ''}). Essayez plutôt GJS.`);
  };

  const onMove = (e) => {
    if (!running || done) return;
    const r = other.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const reach = Math.max(r.width, r.height) / 2 + 70;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < reach) flee(e.clientX, e.clientY);
  };

  const onOtherDown = (e) => { e.preventDefault(); flee(e.clientX, e.clientY); };
  const onOtherTouch = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    flee(t.clientX, t.clientY);
  };
  const onOtherClick = (e) => {
    e.preventDefault();
    const r = other.getBoundingClientRect();
    flee(r.left + r.width / 2, r.top + r.height / 2);
  };
  // Clavier : le bouton s'échappe dès qu'il reçoit le focus
  const onOtherFocus = () => {
    if (done) return;
    const r = other.getBoundingClientRect();
    flee(r.left + r.width / 2, r.top + r.height / 2);
    gjs.focus();
    api.live('Ce bouton est timide : le focus revient sur GJS, le bon choix.');
  };

  const win = () => {
    if (done || !running) return;
    done = true;
    const r = gjs.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    particles.burst(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, { count: api.reduced ? 30 : 160, colors: [PALETTE.lime, PALETTE.ink, PALETTE.cream], speed: 520, size: 9, life: 1.4 });
    loop.start();
    sound.win();
    gjs.classList.add('is-chosen');
    gjs.innerHTML = 'Bon choix.<span>On en parle ?</span>';
    gsap.to(other, { scale: 0, autoAlpha: 0, duration: 0.4, ease: 'back.in(2)' });
    if (!api.reduced) gsap.fromTo(gjs, { scale: 0.8 }, { scale: 1.08, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
    const isRecord = saveBest('button', attempts, `${attempts} tentative${attempts > 1 ? 's' : ''} d’esquive`);
    endTimer = setTimeout(() => {
      api.end({
        won: true,
        title: 'Bon choix. <span class="hl">On en parle ?</span>',
        detail: attempts
          ? `Vous avez tenté ${attempts} fois de cliquer ailleurs. On apprécie la persévérance : on mettra la même dans votre projet.`
          : 'Du premier coup. Vous savez reconnaître le bon partenaire.',
        score: attempts,
        scoreLabel: `Tentatives d’esquive : ${attempts}`,
        isRecord,
        message: 'Sur-mesure, mesuré, sans baratin. Racontez-nous vos objectifs.',
        cta: { label: 'Parlons-en', href: 'contact.html#formulaire' },
      });
    }, 1500);
  };

  stage.addEventListener('pointermove', onMove);
  other.addEventListener('pointerdown', onOtherDown);
  other.addEventListener('touchstart', onOtherTouch, { passive: false });
  other.addEventListener('click', onOtherClick);
  other.addEventListener('focus', onOtherFocus);
  gjs.addEventListener('click', win);
  const onResize = () => { if (!done) initial(); };
  window.addEventListener('resize', onResize);

  initial();

  return {
    start() {
      running = true;
      if (!api.reduced) gsap.from([gjs, other], { scale: 0, duration: 0.6, stagger: 0.12, ease: 'back.out(1.8)' });
      gjs.focus({ preventScroll: true });
    },
    pause() { running = false; },
    resume() { running = true; },
    destroy() {
      running = false;
      clearTimeout(endTimer);
      loop.stop();
      stage.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      gsap.killTweensOf([gjs, other]);
      fx.destroy();
      stage.innerHTML = '';
    },
  };
}
