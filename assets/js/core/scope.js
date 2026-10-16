/* ==========================================================================
   GJS — SCOPE DE CYCLE DE VIE
   Chaque page (et chaque composant éphémère) crée un scope : tout ce qui y est
   enregistré (tweens, ScrollTriggers, SplitText, écouteurs, observers, boucles,
   timers) est détruit d'un seul appel à destroy(). C'est la garantie anti-fuite
   mémoire après N navigations Barba.
   ========================================================================== */

const { gsap } = window;

export function createScope(root = document) {
  const cleanups = [];
  const ctx = gsap.context(() => {}, root);
  const mm = gsap.matchMedia(root);
  let destroyed = false;

  const scope = {
    root,
    ctx,
    mm,
    get destroyed() { return destroyed; },

    /** Exécute fn dans le contexte GSAP (les animations créées seront revert()). */
    add(fn) {
      if (destroyed) return undefined;
      return ctx.add(fn);
    },

    on(target, type, handler, options) {
      if (!target) return;
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    },

    ticker(fn) {
      gsap.ticker.add(fn);
      cleanups.push(() => gsap.ticker.remove(fn));
    },

    intersect(elements, callback, options = {}) {
      const io = new IntersectionObserver((entries) => entries.forEach(callback), options);
      [].concat(elements).filter(Boolean).forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
      return io;
    },

    resize(elements, callback) {
      const ro = new ResizeObserver(callback);
      [].concat(elements).filter(Boolean).forEach((el) => ro.observe(el));
      cleanups.push(() => ro.disconnect());
      return ro;
    },

    interval(fn, ms) {
      const id = setInterval(fn, ms);
      cleanups.push(() => clearInterval(id));
      return id;
    },

    timeout(fn, ms) {
      const id = setTimeout(fn, ms);
      cleanups.push(() => clearTimeout(id));
      return id;
    },

    cleanup(fn) {
      cleanups.push(fn);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (let i = cleanups.length - 1; i >= 0; i -= 1) {
        try { cleanups[i](); } catch (err) { /* un nettoyage ne doit jamais bloquer les suivants */ }
      }
      cleanups.length = 0;
      mm.revert();
      ctx.revert();
    },
  };

  return scope;
}
