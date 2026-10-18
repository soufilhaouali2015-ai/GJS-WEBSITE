/* ==========================================================================
   GJS · HERO VIDÉO
   Un seul « état » de carte, calculé à partir de la progression du scroll,
   pilote tout : la carte (DOM ou WebGL), son ombre, le titre en deux couches,
   l'étiquette crème et le bouton pause.
     ordinateur : section épinglée (1,5 écran) + scène WebGL (si disponible)
     mobile     : pas d'épinglage, la carte rétrécit et s'incline au scroll
     réduit     : rien de lié au scroll, vidéo en pause sur le poster
   Tout est animé en transform (et opacity).
   ========================================================================== */

import { profile, isDesktop, isReduced, canWebGL, saveData } from '../core/profile.js';
import { scrollVelocity } from '../core/scroll.js';
import { isPaused, onPause, setPaused } from '../core/pause.js';
import { spring, SPRING } from '../core/spring.js';

const { gsap, ScrollTrigger } = window;

const VEIL_DESKTOP = [0.6, 0.52, 0.2]; // identique au dégradé CSS .hero__veil
const S_END = isDesktop ? 0.56 : 0.88; // échelle finale de la carte
const RADIUS_END = 22;
const BORDER = 3;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function initHero() {
  const root = document.querySelector('[data-hero]');
  if (!root) return;
  const stage = root.querySelector('[data-hero-stage]');
  const video = root.querySelector('[data-hero-video]');
  const card = root.querySelector('[data-hero-card]');
  const counter = root.querySelector('[data-hero-counter]');
  const shadow = root.querySelector('[data-hero-shadow]');
  const border = root.querySelector('[data-hero-border]');
  const label = root.querySelector('[data-hero-label]');
  const pause = root.querySelector('.hero__pause');
  const canvas = root.querySelector('[data-hero-gl]');
  const inkLines = [...root.querySelectorAll('.hero__title--ink .hero__line')];
  const creamLines = [...root.querySelectorAll('.hero__title--cream .hero__line')];

  /* ---- Vidéo : en pause sur le poster en mouvement réduit ou en économie de
     données (le visiteur peut la lancer avec le bouton). ---- */
  let visible = true;
  const play = () => { if (!isPaused() && visible) video.play().catch(() => {}); };
  if (isReduced || saveData()) {
    video.pause();
    setPaused(true);
  } else {
    video.preload = 'auto';
  }
  onPause((p) => (p ? video.pause() : play()));
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play(); else video.pause();
  }).observe(stage);
  play();

  /* ---- Mesures ---- */
  let M = null;
  function measure() {
    gsap.set([...inkLines, ...creamLines, card, counter, shadow, label, pause], { clearProps: 'transform' });
    counter.style.transform = '';
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const top = card.offsetTop;
    const fw = W;
    const fh = H - top;
    const sRect = stage.getBoundingClientRect();
    // Boîte de chaque ligne, indépendante de l'animation d'entrée (translateY du texte)
    const lines = inkLines.map((line) => {
      const outer = line.getBoundingClientRect();
      const inner = line.firstElementChild.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(line).paddingTop) || 0;
      return { x: inner.left - sRect.left, y: outer.top + pad - sRect.top, w: inner.width, h: outer.height - pad };
    });
    const lr = label.getBoundingClientRect();
    const pr = pause.getBoundingClientRect();
    root.style.setProperty('--label-h', `${Math.round(lr.height)}px`);
    M = {
      W, H, top, fw, fh, fcx: W / 2, fcy: top + fh / 2, lines,
      label: { x: lr.right - sRect.left, y: lr.bottom - sRect.top, w: lr.width, h: lr.height },
      pause: { x: pr.right - sRect.left, y: pr.top - sRect.top },
      gutter: parseFloat(getComputedStyle(root.querySelector('.hero__title')).left) || 16,
    };
    // Rayon et bordure fixés pour l'échelle finale (le DOM ne les anime pas)
    card.style.setProperty('--hero-radius', `${RADIUS_END / S_END}px`);
    shadow.style.setProperty('--hero-radius', `${RADIUS_END / S_END}px`);
    card.style.setProperty('--hero-border', `${BORDER / S_END}px`);
    return M;
  }

  /* ---- État de la carte pour une progression p ∈ [0, 1] ---- */
  function state(p) {
    const e = inOut(clamp(p));
    const s = lerp(1, S_END, e);
    const w = M.fw * s;
    const h = M.fh * s;
    // Ordinateur : la carte se rétracte vers le haut-gauche ; l'étiquette, restée
    // en bas à droite, finit collée sur son coin comme un sticker.
    const cx = isDesktop ? lerp(M.fcx, M.W * 0.42, e) : M.fcx;
    const cy = isDesktop ? lerp(M.fcy, M.H * 0.47, e) : M.fcy;
    const rz = lerp(0, -3, e);
    const bump = Math.sin(Math.PI * e);
    const st = {
      e, s, w, h, cx, cy, rz,
      rx: isDesktop ? 10 * bump : 0,
      ry: isDesktop ? -16 * bump : 0,
      bend: isDesktop ? 120 * bump : 0,
      // Même géométrie que le DOM (rayon et bordure fixés à l'échelle finale) : aucun saut au passage en WebGL
      radius: (RADIUS_END / S_END) * s,
      border: (BORDER / S_END) * s * smooth(0.05, 0.4, e),
      borderAlpha: smooth(0.05, 0.4, e),
      shadowOff: 10 * smooth(0.15, 0.7, e),
      shadowAlpha: smooth(0.1, 0.5, e),
    };
    // Les lignes du titre s'écartent : gauche, droite, gauche (en restant à l'écran)
    const left = cx - w / 2;
    const right = cx + w / 2;
    const targets = [
      left - 0.34 * M.lines[0].w,
      right - 0.55 * M.lines[1].w,
      left - 0.22 * M.lines[2].w,
    ];
    const titleH = M.lines[2].y + M.lines[2].h - M.lines[0].y;
    const dyFinal = isDesktop ? (cy - titleH / 2) - M.lines[0].y : 0;
    const lab = { left: M.label.x - M.label.w - 16, top: M.label.y - M.label.h - 16 };
    st.lines = M.lines.map((r, i) => {
      let tx = clamp(targets[i], M.gutter, M.W - M.gutter - r.w);
      // Jamais sous l'étiquette : si la ligne finit à sa hauteur, elle s'arrête avant
      if (isDesktop && r.y + dyFinal + r.h > lab.top) tx = Math.min(tx, lab.left - r.w);
      tx = Math.max(M.gutter, tx);
      return { dx: (tx - r.x) * e, dy: dyFinal * e };
    });
    return st;
  }

  /* ---- Rendu DOM (repli : mobile, sans WebGL) ---- */
  function applyDom(st, corners) {
    const tx = st.cx - M.fcx;
    const ty = st.cy - M.fcy;
    if (!gl) {
      gsap.set(card, { x: tx, y: ty, rotation: st.rz, scale: st.s, force3D: true });
      counter.style.transform = `scale(${1 / st.s}) rotate(${-st.rz}deg) translate(${-tx}px, ${-ty}px)`;
      gsap.set(shadow, { x: tx + st.shadowOff, y: ty + st.shadowOff, rotation: st.rz, scale: st.s, opacity: st.shadowAlpha, force3D: true });
      border.style.opacity = String(st.borderAlpha);
    }
    st.lines.forEach((l, i) => {
      gsap.set(inkLines[i], { x: l.dx, y: l.dy, force3D: true });
      gsap.set(creamLines[i], { x: l.dx, y: l.dy, force3D: true });
    });
    // Coins de la carte (projetés par WebGL si disponible, sinon calcul 2D)
    const c = corners || flatCorners(st);
    const e = st.e;
    if (isDesktop) {
      // Étiquette : reste en bas à droite, s'incline et vient se coller sur le coin de la carte
      gsap.set(label, { x: lerp(0, -8, e), y: lerp(0, -16, e), rotation: lerp(0, 3, e), force3D: true });
    } else {
      gsap.set(label, { x: c.bl.x, y: c.bl.y - M.H, rotation: lerp(0, 2, e), force3D: true });
    }
    const px = lerp(M.pause.x - M.W, -18, e);
    const py = lerp(M.pause.y - M.top, 18, e);
    gsap.set(pause, { x: c.tr.x + px - M.pause.x, y: c.tr.y + py - M.pause.y, rotation: st.rz, force3D: true });
  }

  function flatCorners(st) {
    const a = (st.rz * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const pt = (u, v) => ({ x: st.cx + u * st.w * cos - v * st.h * sin, y: st.cy + u * st.w * sin + v * st.h * cos });
    return { tr: pt(0.5, -0.5), br: pt(0.5, 0.5), bl: pt(-0.5, 0.5) };
  }

  /* ---- Effets souris / vitesse (ordinateur) ---- */
  const mouseX = spring(SPRING.soft, 0.5);
  const mouseY = spring(SPRING.soft, 0.5);
  const hover = spring(SPRING.soft, 0);
  const vel = spring(SPRING.soft, 0);
  let lastMove = 0;
  let time = 0;

  stage.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || !M) return;
    const r = stage.getBoundingClientRect();
    const st = state(progress);
    const a = (-st.rz * Math.PI) / 180;
    const px = ev.clientX - r.left - st.cx;
    const py = ev.clientY - r.top - st.cy;
    const u = (px * Math.cos(a) - py * Math.sin(a)) / st.w + 0.5;
    const v = (px * Math.sin(a) + py * Math.cos(a)) / st.h + 0.5;
    mouseX.set(u);
    mouseY.set(1 - v);
    hover.set(u > 0 && u < 1 && v > 0 && v < 1 ? 1 : 0);
    lastMove = performance.now();
  });
  stage.addEventListener('pointerleave', () => hover.set(0));

  /* ---- Boucle de rendu (seulement quand le hero est visible) ---- */
  let progress = 0;
  let gl = null;
  let glLines = null;

  function frame(t, dms) {
    if (!visible || !M) return;
    const dt = Math.min(0.05, dms / 1000);
    if (!isPaused()) time += dt;
    if (performance.now() - lastMove > 1400) hover.set(0);
    vel.set(clamp(scrollVelocity() / 45, -1, 1));
    [mouseX, mouseY, hover, vel].forEach((sp) => sp.step(dt));
    const st = state(progress);
    let corners = null;
    if (gl) {
      if (gl.lost) { disableGL(); } else {
        const lines = M.lines.map((r, i) => {
          const ext = glLines ? glLines[i] : { extTop: 0, extBottom: 0 };
          return { x: r.x + st.lines[i].dx, y: r.y + st.lines[i].dy - ext.extTop, w: r.w, h: r.h + ext.extTop + ext.extBottom };
        });
        corners = gl.render(st, { time, mouse: { x: mouseX.value, y: mouseY.value }, hover: hover.value, vel: vel.value, lines });
      }
    }
    applyDom(st, corners);
  }

  /* ---- Scroll ---- */
  measure();
  if (!isReduced) {
    ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: isDesktop ? '+=150%' : 'bottom top',
      pin: isDesktop,
      pinSpacing: true,
      scrub: true,
      onUpdate: (self) => { progress = self.progress; },
      onRefreshInit: () => { measure(); },
      onRefresh: (self) => { progress = self.progress; },
    });
    gsap.ticker.add(frame);
  }

  new ResizeObserver(() => {
    if (isReduced) return;
    measure();
    if (gl) { gl.resize(M.W, M.H); buildTitle(); }
  }).observe(stage);

  /* ---- WebGL (ordinateur) : chargé après le premier affichage ---- */
  function titleSegments() {
    // Mesure chaque morceau de texte dans la couche crème (même géométrie que la noire)
    return creamLines.map((line, i) => {
      const inner = line.firstElementChild;
      const base = inner.getBoundingClientRect();
      const fontSize = parseFloat(getComputedStyle(inner).fontSize);
      const segments = [];
      inner.childNodes.forEach((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rr = range.getBoundingClientRect();
        const text = (node.textContent || '').toUpperCase();
        if (!text.trim() && node.nodeType === 3) return;
        if (node.nodeType === 1 && node.classList.contains('hl')) {
          const er = node.getBoundingClientRect();
          const fs = fontSize;
          segments.push({
            text, x: rr.left - base.left, color: '#141414',
            block: { x: er.left - base.left, y: er.top - base.top + 0.04 * fs, w: er.width, h: er.height - 0.12 * fs },
          });
        } else {
          segments.push({ text, x: rr.left - base.left, color: '#F4F0E8' });
        }
      });
      return { rect: M.lines[i], fontSize, segments, extTop: 0.24 * fontSize, extBottom: 0.14 * fontSize };
    });
  }

  function buildTitle() {
    if (!gl) return;
    glLines = gl.setTitle(titleSegments());
  }

  function disableGL() {
    if (!gl) return;
    gl.dispose();
    gl = null;
    root.classList.remove('is-gl');
  }

  async function enableGL() {
    if (gl || !isDesktop || saveData() || !canWebGL()) return;
    try {
      await document.fonts.load('400 100px "Bebas Neue"');
      const { createHeroGL } = await import('./webgl.js');
      gl = await createHeroGL({ canvas, video, veil: VEIL_DESKTOP });
      if (!gl) return;
      measure();
      gl.resize(M.W, M.H);
      buildTitle();
      frame(0, 16);
      root.classList.add('is-gl');
    } catch (err) {
      console.warn('Hero WebGL indisponible, repli CSS.', err);
      disableGL();
    }
  }

  if (isDesktop) {
    const start = () => {
      // On laisse la révélation CSS du titre se terminer avant de passer en WebGL
      const wait = Math.max(0, 1400 - performance.now());
      setTimeout(() => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(enableGL, { timeout: 1200 });
        else enableGL();
      }, wait);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    // Cache arrière/avant du navigateur : on libère la scène et on la recrée au retour
    window.addEventListener('pagehide', () => disableGL());
    window.addEventListener('pageshow', (ev) => { if (ev.persisted) start(); });
  }

  // Exposé pour les vérifications automatisées
  window.__gjsHero = { get progress() { return progress; }, get gl() { return Boolean(gl); }, profile };
}
