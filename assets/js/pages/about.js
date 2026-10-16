/* ==========================================================================
   GJS — PAGE QUI SOMMES-NOUS
   G · J · S qui s'écartent au scroll · Portraits N&B → couleur + suivi curseur ·
   Valeurs en cartes superposées · Timeline · Coulisses réorganisées (Flip).
   ========================================================================== */

import { env, $, $$, debounce } from '../core/utils.js';

const { gsap, ScrollTrigger, Flip } = window;

/* ---------- Hero ----------------------------------------------------------- */

function initHero(scope, root) {
  const hero = $('[data-about-hero]', root);
  if (!hero) return;
  const pin = $('.about-hero__pin', hero);
  const letters = $('.about-hero__letters', hero);
  const gaps = $$('[data-gap]', hero);
  const imgs = gaps.map((g) => $('img', g));

  if (env.reducedMotion) {
    gsap.set(gaps, { width: '14vw' });
    gsap.set(letters, { scale: 0.75 });
    return;
  }

  const gapW = () => (window.innerWidth < 768 ? 15 : 17);
  gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: () => `+=${window.innerHeight * 1.1}`,
      pin,
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  })
    .to(gaps, { width: () => `${gapW()}vw`, ease: 'power2.inOut', duration: 1 }, 0)
    .to(letters, { scale: 0.7, ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo(imgs, { scale: 1.5 }, { scale: 1, ease: 'none', duration: 1.2 }, 0)
    .to($$('[data-letter]', hero), { yPercent: (i) => [-6, 8, -4][i], ease: 'none', duration: 1.2 }, 0);
}

/* ---------- Équipe : léger déplacement selon le curseur ------------------- */

function initTeam(scope, root) {
  if (!env.finePointer || env.reducedMotion) return;
  $$('[data-member]', root).forEach((member) => {
    const img = $('.member__img', member);
    const media = $('.member__media', member);
    if (!img) return;
    const qx = gsap.quickTo(img, 'x', { duration: 0.8, ease: 'power3.out' });
    const qy = gsap.quickTo(img, 'y', { duration: 0.8, ease: 'power3.out' });
    scope.on(media, 'pointermove', (e) => {
      const r = media.getBoundingClientRect();
      qx(((e.clientX - r.left) / r.width - 0.5) * -24);
      qy(((e.clientY - r.top) / r.height - 0.5) * -24);
    });
    scope.on(media, 'pointerleave', () => { qx(0); qy(0); });
  });
}

/* ---------- Valeurs : cartes qui se superposent ---------------------------- */

function initValues(scope, root) {
  const section = $('[data-values]', root);
  if (!section) return;
  const cards = $$('[data-value]', section);
  const pin = $('.values__pin', section);

  scope.mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    section.classList.add('is-pinned');
    const rotations = [-3, 2.5, -1.5, 3.5];
    gsap.set(cards, { rotation: (i) => rotations[i], yPercent: (i) => (i ? 140 : 0), transformOrigin: '50% 100%' });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${window.innerHeight * 2.4}`,
        pin,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });
    cards.forEach((card, i) => {
      if (!i) return;
      tl.to(card, { yPercent: i * 4, ease: 'power2.out', duration: 1 }, i - 1)
        .to(cards.slice(0, i), { scale: (j) => 1 - (i - j) * 0.05, ease: 'none', duration: 1 }, i - 1);
    });
    return () => section.classList.remove('is-pinned');
  });
}

/* ---------- Timeline ------------------------------------------------------- */

function initTimeline(scope, root) {
  const wrap = $('[data-timeline]', root);
  if (!wrap) return;
  const rail = $('.timeline__rail', wrap);
  ScrollTrigger.create({
    trigger: wrap,
    start: 'top 70%',
    end: 'bottom 70%',
    scrub: true,
    onUpdate: (self) => rail.style.setProperty('--progress', self.progress.toFixed(4)),
  });
}

/* ---------- Coulisses : de l'éclaté à l'ordonné (Flip) ------------------- */

const SCATTER = [
  ['2%', '4%', '-8deg'], ['58%', '0%', '6deg'], ['30%', '22%', '-3deg'], ['74%', '30%', '9deg'],
  ['6%', '48%', '5deg'], ['44%', '56%', '-10deg'], ['70%', '66%', '4deg'], ['20%', '78%', '-6deg'],
];

function initBackstage(scope, root) {
  const section = $('[data-backstage]', root);
  if (!section || env.reducedMotion) return;
  const grid = $('[data-backstage-grid]', section);
  const items = $$('[data-flip-item]', grid);
  items.forEach((item, i) => {
    const [x, y, r] = SCATTER[i % SCATTER.length];
    item.style.setProperty('--sx', x);
    item.style.setProperty('--sy', y);
    item.style.setProperty('--sr', r);
  });

  let trigger = null;
  let flip = null;

  const build = () => {
    const progress = trigger ? trigger.progress : 0;
    if (trigger) trigger.kill();
    if (flip) flip.revert();
    grid.style.setProperty('--grid-h', `${grid.offsetHeight}px`);
    grid.classList.add('is-scattered');
    const state = Flip.getState(items);
    grid.classList.remove('is-scattered');
    flip = Flip.from(state, { duration: 1, ease: 'power1.inOut', absolute: false, scale: true, simple: true, paused: true });
    trigger = ScrollTrigger.create({
      trigger: grid,
      start: 'top 85%',
      end: 'center 55%',
      scrub: 0.8,
      animation: flip,
    });
    flip.progress(progress);
  };

  scope.add(build);
  const rebuild = debounce(() => scope.add(build), 250);
  scope.on(window, 'resize', rebuild);
  scope.cleanup(() => {
    rebuild.cancel();
    if (trigger) trigger.kill();
    if (flip) flip.revert();
  });
}

/* ---------- Cycle de vie --------------------------------------------------- */

export default {
  init(scope, root) {
    initHero(scope, root);
    initTeam(scope, root);
    initValues(scope, root);
    initTimeline(scope, root);
    initBackstage(scope, root);
  },
  destroy() {},
};
