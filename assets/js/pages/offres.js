/* ==========================================================================
   GJS — PAGE NOS OFFRES
   Hero « pack » barré · Expertises empilées en sticky · Timeline horizontale
   épinglée · Configurateur de besoin → contact pré-rempli.
   ========================================================================== */

import { env, $, $$, announce } from '../core/utils.js';

const { gsap, ScrollTrigger } = window;

/* ---------- Hero ----------------------------------------------------------- */

function heroIntro(root, tl) {
  const lines = $$('[data-hero-line] > span', root);
  const path = $('.offers-hero__scribble path', root);
  const strike = $('.offers-hero__strike', root);
  if (!lines.length) return;
  const length = path ? path.getTotalLength() : 0;
  if (path) gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  if (env.reducedMotion) {
    tl.from(lines, { opacity: 0, duration: 0.6 }, 0.1);
    if (path) tl.set(path, { strokeDashoffset: 0 }, 0.5);
    return;
  }
  tl.from(lines, { yPercent: 112, duration: 1.2, stagger: 0.12, ease: 'gjs' }, 0.1);
  if (path) tl.to(path, { strokeDashoffset: 0, duration: 0.9, ease: 'power3.inOut' }, 0.95);
  if (strike) tl.to(strike, { opacity: 0.45, duration: 0.6 }, 1.4);
}

/* ---------- Expertises : pile sticky ------------------------------------- */

function initStack(scope, root) {
  const panels = $$('[data-expertise]', root);
  if (!panels.length) return;

  // Une section plus haute que l'écran colle quand son bas atteint le bas de
  // l'écran : tout son contenu est lisible avant que la suivante ne la recouvre.
  const setTops = () => {
    panels.forEach((panel) => {
      const top = Math.min(0, window.innerHeight - panel.offsetHeight);
      panel.style.setProperty('--sticky-top', `${top}px`);
    });
  };
  setTops();
  scope.resize(panels, setTops);
  scope.on(window, 'resize', setTops);

  if (env.reducedMotion) return;
  panels.forEach((panel, i) => {
    const next = panels[i + 1];
    if (!next) return;
    gsap.to($('.expertise__inner', panel), {
      scale: 0.94,
      opacity: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
    });
  });
}

/* ---------- Process : timeline horizontale épinglée ---------------------- */

function initProcess(scope, root) {
  const section = $('[data-process]', root);
  if (!section) return;
  const pin = $('.process__pin', section);
  const track = $('.process__track', section);
  const line = $('.process__line', section);
  const steps = $$('.process__step', section);

  scope.mm.add('(min-width: 1024px)', () => {
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin,
        scrub: 0.7,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => line.style.setProperty('--progress', self.progress.toFixed(4)),
      },
    });
    if (!env.reducedMotion) {
      steps.forEach((step) => {
        gsap.from(step.children, {
          y: 40,
          opacity: 0,
          stagger: 0.06,
          ease: 'power3.out',
          scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left 85%', toggleActions: 'play none none reverse' },
        });
      });
    }
  });

  scope.mm.add('(max-width: 1023px)', () => {
    ScrollTrigger.create({
      trigger: track,
      start: 'top 70%',
      end: 'bottom 70%',
      scrub: true,
      onUpdate: (self) => line.style.setProperty('--progress', self.progress.toFixed(4)),
    });
  });
}

/* ---------- Configurateur ------------------------------------------------- */

const joinFr = (items) => {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
};

function initConfigurator(scope, root) {
  const form = $('[data-configurator]', root);
  if (!form) return;
  const sentence = $('[data-config-sentence]', form);
  const submit = $('[data-config-submit]', form);
  const hint = $('[data-config-hint]', form);
  const defaultHint = hint.textContent;
  let last = '';

  const read = () => {
    const needs = $$('input[name="besoins"]:checked', form);
    const horizon = $('input[name="horizon"]:checked', form);
    const goal = $('input[name="objectif"]:checked', form);
    return { needs, horizon, goal };
  };

  const render = () => {
    const { needs, horizon, goal } = read();
    let html;
    if (!needs.length) {
      html = '<span class="is-empty">Cochez au moins une expertise : la synthèse se compose ici.</span>';
      submit.setAttribute('aria-disabled', 'true');
    } else {
      const what = joinFr(needs.map((n) => n.dataset.phrase));
      const why = goal ? goal.dataset.phrase : 'faire décoller votre activité';
      const when = horizon ? horizon.dataset.phrase : 'sans urgence';
      html = `Vous voulez <em class="serif">${what}</em> pour <em class="serif">${why}</em>, <em class="serif">${when}</em>. On s’en occupe.`;
      submit.removeAttribute('aria-disabled');
      hint.textContent = defaultHint;
    }
    if (html === last) return;
    last = html;
    sentence.innerHTML = html;
    if (!env.reducedMotion) {
      gsap.fromTo(sentence.querySelectorAll('em, .is-empty'), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'expo.out' });
    }
  };

  scope.on(form, 'change', render);
  scope.on(form, 'submit', (e) => {
    e.preventDefault();
    const { needs, horizon, goal } = read();
    if (!needs.length) {
      hint.textContent = 'Choisissez au moins une expertise pour recevoir une proposition.';
      announce(hint.textContent, 'assertive');
      $('input[name="besoins"]', form).focus();
      return;
    }
    const params = new URLSearchParams();
    params.set('besoins', needs.map((n) => n.value).join(','));
    if (horizon) params.set('horizon', horizon.value);
    if (goal) params.set('objectif', goal.value);
    const url = `contact.html?${params.toString()}`;
    if (window.barba && typeof window.barba.go === 'function') window.barba.go(url);
    else window.location.href = url;
  });
  render();
}

/* ---------- Cycle de vie --------------------------------------------------- */

export default {
  init(scope, root) {
    initStack(scope, root);
    initProcess(scope, root);
    initConfigurator(scope, root);
  },
  intro(scope, root, tl) {
    heroIntro(root, tl);
  },
  destroy() {},
};
