/* ==========================================================================
   GJS · « COMMENT ÇA MARCHE »
   Un trait de marqueur citron se dessine au fil du scroll et relie les
   4 étapes. Quand il atteint une étape, son numéro passe au citron et
   grossit avec le ressort, puis son texte apparaît d'un coup (0,6 s).
     ordinateur : scène collante (position: sticky) sur ~2 écrans, trait ondulé horizontal
     mobile     : trait vertical à gauche, sans épinglage
     réduit     : tout est affiché, trait complet, rien ne bouge
   Le trait est révélé par deux translations opposées (le masque avance,
   le dessin reste en place) : uniquement du transform.
   ========================================================================== */

import { isReduced } from '../core/profile.js';
import { spring, SPRING, run } from '../core/spring.js';

const { gsap, ScrollTrigger } = window;

function bump(num) {
  // Le numéro grossit puis se pose, avec le ressort « rebond » commun au site
  const s = spring(SPRING.bouncy, 0.7);
  s.set(1);
  const setX = gsap.quickSetter(num, 'scaleX');
  const setY = gsap.quickSetter(num, 'scaleY');
  run((dt) => {
    s.step(dt);
    setX(s.value);
    setY(s.value);
    return !s.settled;
  });
}

export function initSteps(root = document) {
  const track = root.querySelector('[data-steps]');
  if (!track) return;
  const section = track.closest('section');
  const steps = [...track.querySelectorAll('.step')];
  const nums = steps.map((st) => st.querySelector('.step__num'));
  const texts = steps.map((st) => [...st.children].filter((c) => !c.classList.contains('step__num')));
  const line = track.querySelector('.steps__line');
  const lineIn = track.querySelector('.steps__line-in');
  if (!line || !lineIn) return;
  track.classList.add(isReduced ? 'is-drawn' : 'is-armed');
  const reached = steps.map(() => false);
  let horizontal = true;
  let marks = []; // position de chaque numéro le long du trait, de 0 à 1

  const reach = (i) => {
    if (reached[i]) return;
    reached[i] = true;
    steps[i].classList.add('is-reached');
    bump(nums[i]);
    gsap.to(texts[i], { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out', overwrite: 'auto' });
  };

  // Le trait relie le centre du premier numéro au centre du dernier
  const measure = () => {
    gsap.set([line, lineIn], { clearProps: 'transform' });
    horizontal = getComputedStyle(track).getPropertyValue('--steps-axis').trim() !== 'y';
    const box = track.getBoundingClientRect();
    const centers = nums.map((n) => {
      const r = n.getBoundingClientRect();
      return horizontal ? r.left + r.width / 2 - box.left : r.top + r.height / 2 - box.top;
    });
    const first = centers[0];
    const last = centers[centers.length - 1];
    const span = Math.max(1, last - first);
    const r = nums[0].getBoundingClientRect();
    if (horizontal) {
      line.style.cssText = `left:${first}px;width:${span}px;top:${r.top + r.height / 2 - box.top - line.offsetHeight / 2}px;`;
    } else {
      line.style.cssText = `top:${first}px;height:${span}px;left:${r.left + r.width / 2 - box.left - line.offsetWidth / 2}px;`;
    }
    marks = centers.map((c) => (c - first) / span);
  };

  const draw = (p) => {
    const q = gsap.utils.clamp(0, 1, p);
    const prop = horizontal ? 'xPercent' : 'yPercent';
    gsap.set(line, { [prop]: (q - 1) * 100 });
    gsap.set(lineIn, { [prop]: (1 - q) * 100 });
    marks.forEach((m, i) => { if (q >= m - 0.001) reach(i); });
  };

  // Mouvement réduit : le trait est posé en entier, tout est affiché
  if (isReduced) {
    measure();
    new ResizeObserver(() => measure()).observe(track);
    return;
  }

  gsap.set(texts.flat(), { opacity: 0, y: 16 });
  measure();
  draw(0);

  // La scène est collante (sticky) seulement sur ordinateur, en CSS : on lit
  // la progression sur toute la hauteur réservée de la section.
  const sticky = () => getComputedStyle(section.querySelector('.methode__stage') || section).position === 'sticky';
  const top = () => section.getBoundingClientRect().top + window.scrollY;
  ScrollTrigger.create({
    trigger: track,
    start: () => (sticky() ? top() : 'top 72%'),
    end: () => (sticky() ? top() + section.offsetHeight - window.innerHeight : 'bottom 58%'),
    // Sur ordinateur, on laisse un peu de marge en fin de course : la dernière étape s'allume avant la sortie
    onUpdate: (self) => draw(sticky() ? self.progress / 0.85 : self.progress),
    onRefreshInit: measure,
    onRefresh: (self) => draw(sticky() ? self.progress / 0.85 : self.progress),
    invalidateOnRefresh: true,
  });
}
