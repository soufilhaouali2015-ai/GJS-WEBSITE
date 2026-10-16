/* ==========================================================================
   GJS — PAGE 404 : le vaisseau perdu dans l'espace
   ========================================================================== */

import { env, $, rand } from '../core/utils.js';

const { gsap } = window;

function starfield(scope, canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let stars = [];
  let visible = true;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.offsetWidth;
    h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((w * h) / 3500) }, () => ({
      x: rand(0, w), y: rand(0, h), s: rand(0.5, 1.8), v: rand(4, 22), p: rand(0, Math.PI * 2),
    }));
  };

  resize();
  scope.resize(canvas, resize);
  scope.intersect(canvas, (entry) => { visible = entry.isIntersecting; });

  const draw = (time, deltaMs) => {
    if (!visible) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!env.reducedMotion) {
        s.x -= s.v * dt;
        s.y += s.v * dt * 0.25;
        if (s.x < 0) s.x = w;
        if (s.y > h) s.y = 0;
      }
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.abs(Math.sin(time * 0.8 + s.p))})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  };
  scope.ticker(draw);
}

export default {
  init(scope, root) {
    const canvas = $('[data-lost-stars]', root);
    if (canvas) starfield(scope, canvas);
    const ship = $('[data-lost-ship]', root);
    if (ship && !env.reducedMotion) {
      // Dérive lente, rotation sur lui-même : il cherche son chemin
      gsap.to(ship, { rotation: 360, duration: 26, ease: 'none', repeat: -1 });
      gsap.to(ship, { x: '12vw', y: '-6vh', duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }
  },
  destroy() {},
};
