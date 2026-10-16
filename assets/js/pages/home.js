/* ==========================================================================
   GJS — PAGE ACCUEIL
   Hero vidéo · Manifeste au scrub · Services horizontaux épinglés ·
   Projets (distorsion + panneau Flip) · Méthode (trajectoire SVG) ·
   Arcade (records) · Carrousel de témoignages draggable avec inertie.
   ========================================================================== */

import { env, $, $$, clamp, store, trapFocus } from '../core/utils.js';
import { lockScroll, unlockScroll } from '../core/scroll.js';
import { refreshCursor } from '../core/cursor.js';
import { yieldToMain } from '../core/utils.js';

const { gsap, ScrollTrigger, Flip } = window;

/* ---------- Hero ----------------------------------------------------------- */

function initHero(scope, root) {
  const hero = $('.hero', root);
  const media = $('[data-hero-media]', root);
  const video = $('[data-hero-video]', root);
  const toggle = $('[data-video-toggle]', root);
  const sound = $('[data-video-sound]', root);
  if (!hero || !video) return;

  let userPaused = false;

  const renderUI = () => {
    const paused = video.paused;
    if (toggle) {
      toggle.textContent = paused ? 'Lire la vidéo' : 'Pause vidéo';
      toggle.setAttribute('aria-pressed', String(paused));
    }
    if (media) media.dataset.cursorLabel = paused ? 'Play' : 'Pause';
    refreshCursor();
  };

  const play = () => {
    const p = video.play();
    if (p && p.catch) p.catch(() => { renderUI(); });
  };

  // Économie de données : on coupe le téléchargement, le poster reste affiché
  if (env.saveData) {
    video.removeAttribute('autoplay');
    video.preload = 'none';
    video.querySelectorAll('source').forEach((s) => s.remove());
    video.load();
    video.dataset.disabled = 'true';
    if (toggle) toggle.hidden = true;
    if (sound) sound.hidden = true;
  } else if (env.reducedMotion) {
    // Mouvement réduit : pas de lecture automatique, l'utilisateur choisit
    video.pause();
    userPaused = true;
  } else {
    play();
  }

  const togglePlay = () => {
    if (video.dataset.disabled) return;
    if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
  };

  scope.on(video, 'play', renderUI);
  scope.on(video, 'pause', renderUI);
  if (toggle) scope.on(toggle, 'click', togglePlay);
  if (media) scope.on(media, 'click', togglePlay);
  if (sound) {
    scope.on(sound, 'click', () => {
      video.muted = !video.muted;
      sound.textContent = video.muted ? 'Son : coupé' : 'Son : activé';
      sound.setAttribute('aria-pressed', String(!video.muted));
    });
  }

  // Pause hors écran (performance), reprise si l'utilisateur n'a pas mis en pause
  scope.intersect(hero, (entry) => {
    if (video.dataset.disabled) return;
    if (!entry.isIntersecting) video.pause();
    else if (!userPaused) play();
  });

  renderUI();

  // La vidéo se rétrécit en carte, le titre part en parallaxe inverse
  if (!env.reducedMotion) {
    const scale = window.innerWidth < 768 ? 0.86 : 0.72;
    gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => `+=${window.innerHeight * 0.9}`,
        scrub: 0.4,
        invalidateOnRefresh: true,
      },
    })
      .to(media, { scale, borderRadius: `${24 / scale}px`, ease: 'none' }, 0)
      .to($('.hero__content', root), { yPercent: -85, autoAlpha: 0, ease: 'none' }, 0)
      .to($$('.hero__corners, .hero__controls', root), { autoAlpha: 0, ease: 'none', duration: 0.4 }, 0);
  }
}

/* ---------- Manifeste : mots de 15 % → 100 % ------------------------------- */

function wrapWords(node) {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const parts = child.textContent.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const span = document.createElement('span');
        span.className = 'mw';
        span.textContent = part;
        frag.appendChild(span);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('manifesto__img')) {
      wrapWords(child);
    }
  });
}

function initManifesto(scope, root) {
  const text = $('[data-manifesto]', root);
  if (!text || env.reducedMotion) return;
  wrapWords(text);
  const words = $$('.mw', text);
  const images = $$('.manifesto__img', text);
  gsap.fromTo(words, { opacity: 0.15 }, {
    opacity: 1,
    ease: 'none',
    stagger: 0.06,
    scrollTrigger: { trigger: text, start: 'top 78%', end: 'bottom 52%', scrub: 0.5 },
  });
  gsap.fromTo(images, { scale: 0.2, rotate: -12 }, {
    scale: 1,
    rotate: 0,
    ease: 'back.out(1.6)',
    stagger: 0.2,
    scrollTrigger: { trigger: text, start: 'top 70%', end: 'bottom 60%', scrub: 0.8 },
  });
}

/* ---------- Services : horizontal épinglé (desktop) / cartes empilées ------ */

function initServices(scope, root) {
  const section = $('.services', root);
  if (!section) return;
  const pin = $('.services__pin', section);
  const track = $('.services__track', section);
  const panels = $$('.service', section);
  const bar = $('.services__bar', section);
  const counter = $('[data-services-current]', section);

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
        onUpdate: (self) => {
          bar.style.setProperty('--progress', self.progress.toFixed(4));
          const n = clamp(Math.round(self.progress * (panels.length - 1)) + 1, 1, panels.length);
          counter.textContent = String(n).padStart(2, '0');
        },
      },
    });

    panels.forEach((panel) => {
      const media = $('[data-service-media]', panel);
      const img = media && $('img', media);
      const num = $('.service__num', panel);
      if (media && !env.reducedMotion) {
        gsap.fromTo(media, { clipPath: 'inset(0% 0% 0% 100%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)',
          ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 92%', end: 'left 35%', scrub: true },
        });
        if (img) {
          gsap.fromTo(img, { scale: 1.35 }, {
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 92%', end: 'right 40%', scrub: true },
          });
        }
      }
      if (num && !env.reducedMotion) {
        gsap.fromTo(num, { x: 140 }, {
          x: -140,
          ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      }
    });
  });

  scope.mm.add('(max-width: 1023px)', () => {
    if (env.reducedMotion) return;
    panels.forEach((panel, i) => {
      const next = panels[i + 1];
      if (!next) return;
      gsap.to(panel, {
        scale: 0.92,
        opacity: 0.45,
        ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 30%', scrub: true },
      });
    });
  });
}

/* ---------- Projets : distorsion au survol + panneau Flip ------------------ */

function initProjects(scope, root) {
  const projects = $$('[data-project]', root);
  const dialog = $('[data-project-panel]', root);
  if (!projects.length || !dialog) return;
  const panelMedia = $('[data-panel-media]', dialog);
  const panelContent = $('[data-panel-content]', dialog);
  const displacement = document.querySelector('#gjs-distort feDisplacementMap');
  let current = -1;
  let release = null;
  let trigger = null;
  let busy = false;

  // Distorsion SVG (desktop uniquement)
  if (env.finePointer && !env.reducedMotion && displacement) {
    projects.forEach((project) => {
      const btn = $('.project__trigger', project);
      scope.on(btn, 'pointerenter', () => {
        btn.classList.add('is-distorting');
        gsap.timeline({ overwrite: true })
          .to(displacement, { attr: { scale: 38 }, duration: 0.35, ease: 'power2.out' })
          .to(displacement, { attr: { scale: 0 }, duration: 0.9, ease: 'power3.out', onComplete: () => btn.classList.remove('is-distorting') });
      });
      scope.on(btn, 'pointerleave', () => {
        gsap.to(displacement, { attr: { scale: 0 }, duration: 0.3, overwrite: true, onComplete: () => btn.classList.remove('is-distorting') });
      });
    });
  }

  const fill = (index) => {
    const project = projects[index];
    const detail = $('.project__detail', project);
    panelContent.innerHTML = detail.innerHTML;
    const title = $('.project-panel__title', panelContent);
    if (title) title.id = 'project-panel-title';
    const picture = $('picture', project).cloneNode(true);
    const img = $('img', picture);
    img.removeAttribute('loading');
    img.sizes = '(min-width: 1024px) 58vw, 100vw';
    img.alt = $('img', project).alt;
    panelMedia.replaceChildren(picture);
  };

  const open = (index, fromBtn) => {
    if (busy) return;
    busy = true;
    current = index;
    trigger = fromBtn;
    const cardMedia = $('.project__media', projects[index]);
    fill(index);
    lockScroll('project');
    const state = Flip.getState(cardMedia);
    dialog.showModal();
    dialog.scrollTop = 0;
    release = trapFocus(dialog, { restore: false });
    if (env.reducedMotion) {
      gsap.fromTo(dialog, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, onComplete: () => { busy = false; } });
      return;
    }
    gsap.fromTo(dialog, { backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,1)', duration: 0.6, ease: 'power2.out' });
    panelMedia.dataset.flipId = 'project-media';
    cardMedia.dataset.flipId = 'project-media';
    Flip.from(state, {
      targets: panelMedia,
      duration: 1.1,
      ease: 'expo.inOut',
      absolute: true,
      onComplete: () => { busy = false; gsap.set(panelMedia, { clearProps: 'all' }); },
    });
    gsap.from(panelContent.children, { y: 40, autoAlpha: 0, stagger: 0.07, duration: 0.9, ease: 'expo.out', delay: 0.45 });
    gsap.from($$('.project-panel__nav, .panel__close', dialog), { autoAlpha: 0, duration: 0.6, delay: 0.7 });
  };

  const finish = () => {
    dialog.close();
    gsap.set([dialog, panelMedia], { clearProps: 'all' });
    unlockScroll('project');
    if (release) { release(); release = null; }
    if (trigger) trigger.focus({ preventScroll: true });
    busy = false;
  };

  const close = () => {
    if (!dialog.open || busy) return;
    busy = true;
    if (env.reducedMotion) {
      gsap.to(dialog, { autoAlpha: 0, duration: 0.25, onComplete: finish });
      return;
    }
    const cardMedia = $('.project__media', projects[current]);
    gsap.to(panelContent.children, { autoAlpha: 0, y: -20, duration: 0.3, stagger: 0.02 });
    gsap.to(dialog, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.8, delay: 0.2 });
    Flip.fit(panelMedia, cardMedia, { duration: 0.85, ease: 'expo.inOut', absolute: true, onComplete: finish });
  };

  const next = () => {
    if (busy) return;
    const index = (current + 1) % projects.length;
    busy = true;
    gsap.to([panelMedia, panelContent], {
      autoAlpha: 0,
      duration: 0.3,
      onComplete: () => {
        current = index;
        trigger = $('.project__trigger', projects[index]);
        fill(index);
        dialog.scrollTop = 0;
        gsap.to([panelMedia, panelContent], { autoAlpha: 1, duration: 0.5, onComplete: () => { busy = false; } });
        if (!env.reducedMotion) gsap.from(panelContent.children, { y: 30, autoAlpha: 0, stagger: 0.06, duration: 0.8, ease: 'expo.out' });
      },
    });
  };

  projects.forEach((project, i) => {
    const btn = $('.project__trigger', project);
    scope.on(btn, 'click', () => open(i, btn));
  });
  scope.on(dialog, 'cancel', (e) => { e.preventDefault(); close(); });
  scope.on(dialog, 'click', (e) => {
    if (e.target.closest('[data-panel-close]')) close();
    else if (e.target.closest('[data-panel-next]')) next();
  });
  // Navigation Barba pendant que le panneau est ouvert : on le ferme sans animation
  const onLeave = () => { if (dialog.open) finish(); };
  scope.on(document, 'gjs:before-leave', onLeave);
  scope.cleanup(() => { if (dialog.open) finish(); });
}

/* ---------- Méthode : trajectoire dessinée + vaisseau ---------------------- */

function initMethod(scope, root) {
  const section = $('[data-method]', root);
  if (!section) return;
  const track = $('.method__track', section);
  const svg = $('.method__svg', section);
  const path = $('.method__path', section);
  const bgPath = $('.method__path-bg', section);
  const ship = $('.method__ship', section);
  const steps = $$('.method__step', section);
  const dots = steps.map((s) => $('.method__dot', s));
  let length = 0;
  let fractions = [];
  let progress = 0;

  const build = () => {
    const box = track.getBoundingClientRect();
    if (!box.width) return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const pts = dots.map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    const all = [{ x: pts[0].x + box.width * 0.08, y: 0 }, ...pts, { x: pts[pts.length - 1].x - box.width * 0.1, y: box.height }];
    // Tracé : courbes de Bézier passant exactement par chaque point d'étape.
    // La position de chaque étape (fraction de longueur) se déduit de la longueur
    // du préfixe du tracé qui s'arrête sur elle : 4 mesures au lieu d'un échantillonnage.
    const segments = [`M${all[0].x.toFixed(1)},${all[0].y.toFixed(1)}`];
    for (let i = 1; i < all.length; i += 1) {
      const a = all[i - 1];
      const b = all[i];
      const dy = (b.y - a.y) * 0.55;
      segments.push(`C${a.x.toFixed(1)},${(a.y + dy).toFixed(1)} ${b.x.toFixed(1)},${(b.y - dy).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    }
    const d = segments.join(' ');
    path.setAttribute('d', d);
    bgPath.setAttribute('d', d);
    length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    probe.setAttribute('visibility', 'hidden');
    svg.appendChild(probe);
    fractions = pts.map((_, i) => {
      probe.setAttribute('d', segments.slice(0, i + 2).join(' '));
      return length ? probe.getTotalLength() / length : 0;
    });
    probe.remove();
    update(progress);
  };

  const update = (p) => {
    progress = p;
    if (!length) return;
    path.style.strokeDashoffset = `${length * (1 - p)}`;
    const at = Math.min(length * p, length - 1);
    const pt = path.getPointAtLength(at);
    const ahead = path.getPointAtLength(Math.min(at + 2, length));
    const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
    gsap.set(ship, { x: pt.x, y: pt.y, xPercent: -50, yPercent: -50, rotation: angle });
    steps.forEach((step, i) => step.classList.toggle('is-active', p >= fractions[i] - 0.005));
  };

  ScrollTrigger.create({
    trigger: track,
    start: 'top 65%',
    end: 'bottom 75%',
    scrub: env.reducedMotion ? true : 0.6,
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => { progress = self.progress; build(); },
  });
  if (!length) build();
}

/* ---------- Arcade : records ---------------------------------------------- */

function initArcade(root) {
  $$('[data-highscore]', root).forEach((el) => {
    const best = store.get(`gjs-arcade-${el.dataset.highscore}`);
    if (best && best.score !== undefined) el.textContent = best.label || String(best.score);
  });
}

/* ---------- Témoignages : carrousel draggable avec inertie ---------------- */

function initCarousel(scope, root) {
  const carousel = $('[data-carousel]', root);
  if (!carousel) return;
  const viewport = $('.carousel__viewport', carousel);
  const track = $('[data-carousel-track]', carousel);
  const slides = $$('.quote', track);
  const status = $('[data-carousel-current]', carousel);
  const pos = { x: 0 };
  let index = 0;
  let dragging = false;
  let startX = 0;
  let startPos = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = false;

  const offsets = () => slides.map((s) => s.offsetLeft - slides[0].offsetLeft);
  const apply = () => gsap.set(track, { x: pos.x });
  const minX = () => -offsets()[slides.length - 1];

  const setActive = () => {
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === index);
      s.setAttribute('aria-hidden', String(i !== index));
    });
    status.textContent = String(index + 1).padStart(2, '0');
  };

  const goTo = (i, immediate = false) => {
    index = clamp(i, 0, slides.length - 1);
    const target = -offsets()[index];
    gsap.killTweensOf(pos);
    if (immediate || env.reducedMotion) { pos.x = target; apply(); }
    else gsap.to(pos, { x: target, duration: 1, ease: 'expo.out', onUpdate: apply });
    setActive();
  };

  scope.on(viewport, 'pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = lastX = e.clientX;
    lastT = performance.now();
    startPos = pos.x;
    velocity = 0;
    gsap.killTweensOf(pos);
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-dragging');
  });

  scope.on(viewport, 'pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    let next = startPos + dx;
    // Résistance élastique aux extrémités
    if (next > 0) next *= 0.35;
    if (next < minX()) next = minX() + (next - minX()) * 0.35;
    pos.x = next;
    apply();
    const dt = Math.max(1, now - lastT);
    velocity = (e.clientX - lastX) / dt; // px/ms
    lastX = e.clientX;
    lastT = now;
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    // Projection inertielle puis aimantation sur la diapositive la plus proche
    const projected = pos.x + velocity * 320;
    const list = offsets();
    let nearest = 0;
    let best = Infinity;
    list.forEach((o, i) => {
      const d = Math.abs(-o - projected);
      if (d < best) { best = d; nearest = i; }
    });
    goTo(nearest);
  };

  scope.on(viewport, 'pointerup', release);
  scope.on(viewport, 'pointercancel', release);
  scope.on(viewport, 'click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  scope.on($('[data-carousel-prev]', carousel), 'click', () => goTo(index - 1));
  scope.on($('[data-carousel-next]', carousel), 'click', () => goTo(index + 1));
  scope.on(carousel, 'keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
  });
  scope.resize(viewport, () => goTo(index, true));
  setActive();
}

/* ---------- Cycle de vie --------------------------------------------------- */

export default {
  async init(scope, root) {
    // Chaque bloc dans sa propre tâche (et dans le contexte GSAP de la page)
    const steps = [initHero, initManifesto, initServices, initProjects, initMethod, initCarousel];
    for (const step of steps) {
      if (scope.destroyed) return;
      scope.add(() => step(scope, root));
      await yieldToMain();
    }
    initArcade(root);
    scope.on(document, 'gjs:highscore', () => initArcade(root));
  },
  destroy() {},
};
