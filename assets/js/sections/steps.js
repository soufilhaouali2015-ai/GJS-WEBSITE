/* ==========================================================================
   GJS · « COMMENT ÇA MARCHE » EN CASCADE (accueil et page Services)
   Les 4 étapes descendent en escalier, chacune décalée vers la droite et vers
   le bas. Un trait de marqueur citron les relie : il part du premier numéro,
   descend, file vers la droite entre deux marches, redescend dans le numéro
   suivant… et se dessine au fil du scroll. Quand il atteint une étape, son
   numéro passe au citron et grossit avec le ressort, puis son texte apparaît.
     ordinateur : marches larges (décalage marqué)
     mobile     : cascade verticale, décalage léger
     réduit     : tout est affiché, trait complet, rien ne bouge
   Le trait est découpé en tronçons droits ; chacun est révélé par deux
   translations opposées (la fenêtre avance, le dessin reste en place) :
   uniquement du transform, aucune propriété de mise en page animée.
   ========================================================================== */

import { isReduced } from '../core/profile.js';
import { spring, SPRING, run } from '../core/spring.js';

const { gsap, ScrollTrigger } = window;
const SVG = 'http://www.w3.org/2000/svg';
const RADIUS = 18; // arrondi des marches du trait (px)
const PAD = 10; // demi-épaisseur du trait + marge, autour de chaque tronçon

function bump(num) {
  // Le numéro grossit puis se pose, avec le ressort « rebond » commun au site
  const s = spring(SPRING.bouncy, 1);
  s.set(1.24);
  let back = false;
  const setX = gsap.quickSetter(num, 'scaleX');
  const setY = gsap.quickSetter(num, 'scaleY');
  run((dt) => {
    s.step(dt);
    if (!back && s.value > 1.2) { back = true; s.set(1); }
    setX(s.value);
    setY(s.value);
    return !(back && s.settled);
  });
}

// Position d'un élément dans la cascade, sans tenir compte des transforms
function offsetIn(el, ancestor) {
  let x = 0;
  let y = 0;
  for (let n = el; n && n !== ancestor; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
}

// Ligne brisée → chemin SVG aux angles arrondis
function roundedPath(points) {
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const a = points[i - 1];
    const b = points[i + 1];
    const inLen = Math.hypot(p.x - a.x, p.y - a.y) || 1;
    const outLen = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    const r = Math.min(RADIUS, inLen / 2, outLen / 2);
    const p1 = { x: p.x - ((p.x - a.x) / inLen) * r, y: p.y - ((p.y - a.y) / inLen) * r };
    const p2 = { x: p.x + ((b.x - p.x) / outLen) * r, y: p.y + ((b.y - p.y) / outLen) * r };
    d += ` L${p1.x} ${p1.y} Q${p.x} ${p.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x} ${last.y}`;
}

function setupCascade(track) {
  const steps = [...track.querySelectorAll('.step')];
  const nums = steps.map((st) => st.querySelector('.step__num'));
  const texts = steps.map((st) => [...st.children].filter((c) => !c.classList.contains('step__num')));
  if (steps.length < 2 || nums.some((n) => !n)) return;

  const layer = document.createElement('div');
  layer.className = 'cascade__line';
  layer.setAttribute('aria-hidden', 'true');
  track.prepend(layer);
  track.classList.add(isReduced ? 'is-drawn' : 'is-armed');

  const reached = steps.map(() => false);
  let segs = []; // { win, inner, axis, len, from }
  let marks = []; // distance (le long du trait) de chaque numéro
  let total = 1;
  let progress = isReduced ? 1 : 0;

  const reach = (i) => {
    if (reached[i]) return;
    reached[i] = true;
    steps[i].classList.add('is-reached');
    if (isReduced) return;
    bump(nums[i]);
    gsap.to(texts[i], { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out', overwrite: 'auto' });
  };

  const draw = () => {
    const d = gsap.utils.clamp(0, 1, progress) * total;
    segs.forEach((s) => {
      const f = gsap.utils.clamp(0, 1, (d - s.from) / s.len);
      const shift = (1 - f) * s.size;
      // La fenêtre recule d'un côté, le dessin avance d'autant : il ne bouge pas à l'écran
      s.win.style.opacity = f > 0 ? '1' : '0'; // fenêtre pas encore atteinte : rien ne dépasse
      s.win.style.transform = s.axis === 'y' ? `translateY(${-shift}px)` : `translateX(${-shift}px)`;
      s.inner.style.transform = s.axis === 'y' ? `translateY(${shift}px)` : `translateX(${shift}px)`;
    });
    marks.forEach((m, i) => { if (d >= m - 0.5) reach(i); });
  };

  const build = () => {
    layer.textContent = '';
    const W = track.clientWidth;
    const H = track.clientHeight;
    // Centre de chaque numéro, et milieu de l'espace entre deux marches
    const centers = nums.map((n) => {
      const o = offsetIn(n, track);
      return { x: Math.round(o.x + n.offsetWidth / 2), y: Math.round(o.y + n.offsetHeight / 2) };
    });
    const gaps = steps.slice(0, -1).map((st, i) => {
      const a = offsetIn(st, track).y + st.offsetHeight;
      const b = offsetIn(steps[i + 1], track).y;
      return Math.round((a + b) / 2);
    });
    const points = [centers[0]];
    gaps.forEach((gy, i) => {
      points.push({ x: centers[i].x, y: gy }, { x: centers[i + 1].x, y: gy });
    });
    points.push(centers[centers.length - 1]);

    // Le dessin complet (bord noir + trait citron), une seule fois
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'cascade__svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('focusable', 'false');
    const d = roundedPath(points);
    ['cascade__edge', 'cascade__ink'].forEach((cls) => {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('class', cls);
      path.setAttribute('d', d);
      svg.appendChild(path);
    });

    // Tronçons droits : chacun montre, par sa fenêtre, la même portion du même dessin
    segs = [];
    let from = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const axis = a.x === b.x ? 'y' : 'x';
      const len = Math.max(1, Math.abs(axis === 'y' ? b.y - a.y : b.x - a.x));
      const box = {
        left: Math.min(a.x, b.x) - PAD,
        top: Math.min(a.y, b.y) - PAD,
        width: Math.abs(b.x - a.x) + PAD * 2,
        height: Math.abs(b.y - a.y) + PAD * 2,
      };
      const win = document.createElement('div');
      win.className = 'cascade__win';
      win.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;`;
      const inner = document.createElement('div');
      inner.className = 'cascade__win-in';
      const copy = svg.cloneNode(true);
      copy.style.left = `${-box.left}px`;
      copy.style.top = `${-box.top}px`;
      inner.appendChild(copy);
      win.appendChild(inner);
      layer.appendChild(win);
      segs.push({ win, inner, axis, len, from, size: axis === 'y' ? box.height : box.width });
      from += len;
    }
    total = from;
    // Chaque numéro est atteint à la fin du tronçon vertical qui y descend
    marks = centers.map((c, i) => {
      if (i === 0) return 0;
      let acc = 0;
      for (let k = 0; k < points.length - 1; k += 1) {
        const a = points[k];
        const b = points[k + 1];
        acc += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        if (b.x === c.x && b.y >= c.y - 1 && a.y < c.y) return Math.min(total, acc - Math.abs(b.y - c.y));
      }
      return total;
    });
    draw();
  };

  if (isReduced) {
    steps.forEach((_, i) => reach(i));
    build();
    new ResizeObserver(() => build()).observe(track);
    return;
  }

  gsap.set(texts.flat(), { opacity: 0, y: 16 });
  build();
  new ResizeObserver(() => build()).observe(track);

  // Le trait suit le scroll : il descend la cascade pendant qu'elle traverse l'écran
  ScrollTrigger.create({
    trigger: track,
    start: 'top 78%',
    end: 'bottom 62%',
    onUpdate: (self) => { progress = self.progress; draw(); },
    onRefresh: (self) => { progress = self.progress; draw(); },
  });
}

export function initSteps(root = document) {
  root.querySelectorAll('[data-steps]').forEach(setupCascade);
}
