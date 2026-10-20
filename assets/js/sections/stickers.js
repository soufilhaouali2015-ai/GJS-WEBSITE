/* ==========================================================================
   GJS · STICKERS DU FOOTER
   Une zone au-dessus des colonnes du footer, où tombent une quinzaine de
   stickers (logo, badges, services). Ce sont de vrais éléments HTML
   (texte net en Bebas), déplacés en transform.
     ordinateur : physique Matter.js, chargée à l'approche du footer ; on peut
                  attraper et lancer les stickers ; pause hors de l'écran
     mobile     : chute et empilement avec rebond (GSAP), un toucher les fait sauter
     réduit     : stickers posés, immobiles (mise en page CSS)
   La zone est décorative (aria-hidden) et ne recouvre jamais les liens.
   ========================================================================== */

import { isDesktop, isReduced } from '../core/profile.js';

const { gsap, ScrollTrigger } = window;
const MATTER_SRC = new URL('../../vendor/matter/matter.min.js', import.meta.url).href;

let matterPromise = null;
function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  if (!matterPromise) {
    matterPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MATTER_SRC;
      s.async = true;
      s.onload = () => resolve(window.Matter);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return matterPromise;
}

const rand = (a, b) => a + Math.random() * (b - a);

/* ---- Ordinateur : vraie physique ------------------------------------------ */

function physics(zone, items, Matter) {
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Sleeping } = Matter;
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1.1;
  let W = zone.clientWidth;
  let H = zone.clientHeight;
  const T = 200; // épaisseur des murs invisibles

  zone.classList.add('is-physics');
  const sizes = items.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
  const setters = items.map((el) => ({
    x: gsap.quickSetter(el, 'x', 'px'),
    y: gsap.quickSetter(el, 'y', 'px'),
    r: gsap.quickSetter(el, 'rotation', 'deg'),
  }));

  const walls = [
    Bodies.rectangle(W / 2, H + T / 2, W * 3, T, { isStatic: true }),
    Bodies.rectangle(-T / 2, H / 2 - H, T, H * 4, { isStatic: true }),
    Bodies.rectangle(W + T / 2, H / 2 - H, T, H * 4, { isStatic: true }),
  ];
  const bodies = sizes.map((s, i) => {
    const x = rand(s.w / 2 + 12, Math.max(s.w / 2 + 13, W - s.w / 2 - 12));
    const y = -s.h - i * 60 - rand(0, 80);
    const opts = { restitution: 0.32, friction: 0.5, frictionAir: 0.012, density: 0.0016, angle: rand(-0.5, 0.5) };
    return Bodies.rectangle(x, y, s.w, s.h, { ...opts, chamfer: { radius: 6 } });
  });
  Composite.add(engine.world, [...walls, ...bodies]);

  // Souris : attraper et lancer. La molette et le tactile restent à la page (Matter les bloquerait).
  const mouse = Mouse.create(zone);
  zone.removeEventListener('wheel', mouse.mousewheel);
  ['touchmove', 'touchstart', 'touchend'].forEach((t) => zone.removeEventListener(t, t === 'touchmove' ? mouse.mousemove : t === 'touchstart' ? mouse.mousedown : mouse.mouseup));
  const release = (e) => mouse.mouseup(e);
  window.addEventListener('mouseup', release);
  const grab = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.12, render: { visible: false } } });
  Composite.add(engine.world, grab);
  Events.on(grab, 'startdrag', () => zone.classList.add('is-grabbing'));
  Events.on(grab, 'enddrag', () => zone.classList.remove('is-grabbing'));

  let visible = false;
  let running = false;
  const tick = (time, deltaMs) => {
    if (!visible || document.hidden) return;
    // Pas fixes de 16,7 ms au plus (stabilité recommandée par Matter)
    const total = Math.min(deltaMs, 50);
    const n = Math.max(1, Math.ceil(total / 16.667));
    for (let k = 0; k < n; k += 1) Engine.update(engine, total / n);
    bodies.forEach((b, i) => {
      const s = sizes[i];
      setters[i].x(b.position.x - s.w / 2);
      setters[i].y(b.position.y - s.h / 2);
      setters[i].r((b.angle * 180) / Math.PI);
    });
  };
  const start = () => { if (!running) { running = true; gsap.ticker.add(tick); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(tick); } };

  const io = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) { bodies.forEach((b) => Sleeping.set(b, false)); start(); } else stop();
  });
  io.observe(zone);

  const ro = new ResizeObserver(() => {
    const w = zone.clientWidth;
    const h = zone.clientHeight;
    if (w === W && h === H) return;
    W = w;
    H = h;
    Body.setPosition(walls[0], { x: W / 2, y: H + T / 2 });
    Body.setPosition(walls[2], { x: W + T / 2, y: H / 2 - H });
    bodies.forEach((b) => {
      Sleeping.set(b, false);
      if (b.position.x > W - 10) Body.setPosition(b, { x: W - 40, y: b.position.y });
    });
  });
  ro.observe(zone);

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('mouseup', release);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    zone.classList.remove('is-physics', 'is-grabbing');
    gsap.set(items, { clearProps: 'transform' });
  };
}

/* ---- Mobile : chute et empilement, sans moteur physique ------------------ */

function drop(zone, items) {
  zone.classList.add('is-physics');
  let spots = null;
  // Rangées depuis le bas, de gauche à droite, avec un peu de désordre
  const layout = () => {
    const W = zone.clientWidth;
    const H = zone.clientHeight;
    let x = 8;
    let floor = H - 8;
    let rowH = 0;
    return items.map((el) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (x + w > W - 8) { x = 8 + rand(0, 16); floor -= rowH - 6; rowH = 0; }
      const spot = { x: Math.min(x, Math.max(0, W - w)), y: Math.max(4, floor - h), r: rand(-9, 9) };
      x += w + rand(-4, 10);
      rowH = Math.max(rowH, h);
      return spot;
    });
  };
  gsap.set(items, { y: -zone.clientHeight, opacity: 0 });
  ScrollTrigger.create({
    trigger: zone,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      spots = layout();
      items.forEach((el, i) => {
        gsap.set(el, { x: spots[i].x, rotation: spots[i].r * 3 });
        gsap.timeline({ delay: i * 0.08 })
          .set(el, { opacity: 1 })
          .to(el, { y: spots[i].y, duration: 1, ease: 'bounce.out' }, 0)
          .to(el, { rotation: spots[i].r, duration: 1, ease: 'expo.out' }, 0);
      });
    },
  });
  // Rotation de l'écran : la pile se refait, sans animation
  let lastW = zone.clientWidth;
  new ResizeObserver(() => {
    if (!spots || zone.clientWidth === lastW) return;
    lastW = zone.clientWidth;
    spots = layout();
    items.forEach((el, i) => { gsap.killTweensOf(el); gsap.set(el, { x: spots[i].x, y: spots[i].y, rotation: spots[i].r, opacity: 1 }); });
  }).observe(zone);
  // Un toucher fait sauter le sticker, qui retombe à sa place
  zone.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.drop');
    if (!el || !spots) return;
    const i = items.indexOf(el);
    gsap.timeline()
      .to(el, { y: spots[i].y - rand(50, 90), rotation: spots[i].r + rand(-25, 25), duration: 0.28, ease: 'power2.out', overwrite: 'auto' })
      .to(el, { y: spots[i].y, rotation: spots[i].r, duration: 0.8, ease: 'bounce.out' });
  });
}

export function initStickers(root = document) {
  const zone = root.querySelector('[data-stickers]');
  if (!zone || isReduced) return;
  const items = [...zone.querySelectorAll('.drop')];
  if (!items.length) return;

  if (!isDesktop) { drop(zone, items); return; }

  let dispose = null;
  const boot = () => {
    if (dispose) return;
    loadMatter()
      .then((Matter) => { if (!dispose) dispose = physics(zone, items, Matter); })
      .catch(() => { drop(zone, items); });
  };
  // Chargement à l'approche du footer (un écran avant)
  const near = new IntersectionObserver((entries) => {
    if (entries[entries.length - 1].isIntersecting) { near.disconnect(); boot(); }
  }, { rootMargin: '0px 0px 100% 0px' });
  near.observe(zone);

  // Cache arrière/avant : on libère la physique, elle repart (nouvelle chute) au retour
  window.addEventListener('pagehide', () => { if (dispose) { dispose(); dispose = null; } });
  window.addEventListener('pageshow', (e) => { if (e.persisted) near.observe(zone); });
}
