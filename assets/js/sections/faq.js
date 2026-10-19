/* ==========================================================================
   GJS · FAQ EN ACCORDÉON (technique FLIP)
   On ne fait jamais varier une hauteur animée : la mise en page change d'un
   coup, puis chaque élément repart de son ancienne position (transform)
   jusqu'à la nouvelle. Le fond de la question s'étire en scaleY, la
   réponse apparaît en fondu, le « + » pivote de 135° avec le ressort.
   Une seule question ouverte à la fois. Sans JS : <details> natif.
   Mouvement réduit : ouverture immédiate, sans glissement.
   ========================================================================== */

import { isReduced } from '../core/profile.js';
import { spring, SPRING, run } from '../core/spring.js';

const { gsap, ScrollTrigger } = window;
const EASE = 'expo.out';
const DUR = 0.7;

function iconSpring(icon) {
  const s = spring(SPRING.bouncy, 0);
  const setR = gsap.quickSetter(icon, 'rotation', 'deg');
  let stop = null;
  return (open) => {
    s.set(open ? 135 : 0);
    if (isReduced) { s.jump(open ? 135 : 0); setR(s.value); return; }
    if (stop) return;
    stop = run((dt) => {
      s.step(dt);
      setR(s.value);
      if (s.settled) { stop = null; return false; }
      return true;
    });
  };
}

export function initFaq(root = document) {
  const list = root.querySelector('.faq');
  if (!list) return;
  const items = [...list.querySelectorAll('.faq__item')];
  const icons = new Map(items.map((it) => [it, iconSpring(it.querySelector('.faq__cross'))]));
  list.classList.add('is-enhanced');
  items.forEach((it) => icons.get(it)(it.open));

  // Tout ce qui suit la FAQ dans la section bouge aussi : on anime les questions
  const flip = (change) => {
    const before = items.map((it) => it.getBoundingClientRect());
    change();
    gsap.killTweensOf(items, 'y,--sy'); // sans toucher au fondu d'entrée éventuel
    gsap.set(items, { y: 0, '--sy': 1 });
    const after = items.map((it) => it.getBoundingClientRect());
    items.forEach((it, i) => {
      const dy = before[i].top - after[i].top;
      const sy = after[i].height ? before[i].height / after[i].height : 1;
      if (Math.abs(dy) < 0.5 && Math.abs(sy - 1) < 0.002) return;
      gsap.fromTo(it, { y: dy, '--sy': sy }, { y: 0, '--sy': 1, duration: DUR, ease: EASE, clearProps: 'transform' });
    });
    // Les déclencheurs plus bas dans la page ont bougé
    gsap.delayedCall(DUR, () => ScrollTrigger.refresh());
  };

  const toggle = (item, open) => {
    const answer = item.querySelector('.faq__a');
    const others = open ? items.filter((it) => it !== item && it.open) : [];
    if (isReduced) {
      others.forEach((it) => { it.open = false; icons.get(it)(false); });
      item.open = open;
      icons.get(item)(open);
      return;
    }
    icons.get(item)(open);
    others.forEach((it) => icons.get(it)(false));
    if (open) {
      flip(() => {
        others.forEach((it) => { it.open = false; });
        item.open = true;
      });
      gsap.fromTo(answer, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.12, ease: EASE, clearProps: 'all' });
    } else {
      // La réponse s'efface d'abord, puis la question se referme en glissant
      gsap.to(answer, {
        opacity: 0,
        duration: 0.2,
        ease: 'power1.out',
        onComplete: () => {
          flip(() => { item.open = false; });
          gsap.set(answer, { clearProps: 'opacity' });
        },
      });
    }
  };

  items.forEach((item) => {
    item.querySelector('.faq__q').addEventListener('click', (e) => {
      e.preventDefault();
      toggle(item, !item.open);
    });
  });
}
