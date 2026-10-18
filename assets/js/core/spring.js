/* ==========================================================================
   GJS · RESSORTS PHYSIQUES
   Un seul moteur pour tout ce qui suit la souris ou le doigt (cartes,
   boutons magnétiques, hero) : même raideur, même amortissement, même
   sensation de matière. Intégration semi-implicite sous-échantillonnée,
   indépendante du nombre d'images par seconde.
   ========================================================================== */

export const SPRING = Object.freeze({
  /* Suivi de la souris : réactif, très léger rebond au retour */
  follow: { stiffness: 220, damping: 22 },
  /* Retour en place : un rebond visible mais bref */
  bouncy: { stiffness: 260, damping: 16 },
  /* Lissage doux (vitesses, intensités) */
  soft: { stiffness: 90, damping: 18 },
});

export function spring(opts = SPRING.follow, value = 0) {
  const { stiffness, damping, mass = 1 } = opts;
  let x = value;
  let v = 0;
  let target = value;
  return {
    get value() { return x; },
    get velocity() { return v; },
    get target() { return target; },
    set(t) { target = t; },
    jump(t) { x = t; target = t; v = 0; },
    step(dt) {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n; i += 1) {
        v += ((-stiffness * (x - target) - damping * v) / mass) * h;
        x += v * h;
      }
      return x;
    },
    get settled() { return Math.abs(x - target) < 0.001 && Math.abs(v) < 0.001; },
  };
}

/* Boucle partagée, branchée sur le ticker GSAP (même image que Lenis et
   ScrollTrigger). Chaque tâche renvoie false quand elle a fini : la boucle
   s'arrête d'elle-même quand plus rien ne bouge. */
const tasks = new Set();
let attached = false;

function tick(time, deltaMs) {
  const dt = Math.min(0.05, deltaMs / 1000);
  tasks.forEach((fn) => { if (fn(dt) === false) tasks.delete(fn); });
  if (!tasks.size) { window.gsap.ticker.remove(tick); attached = false; }
}

export function run(fn) {
  tasks.add(fn);
  if (!attached) { window.gsap.ticker.add(tick); attached = true; }
  return () => tasks.delete(fn);
}
