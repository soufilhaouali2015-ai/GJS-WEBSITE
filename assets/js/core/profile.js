/* ==========================================================================
   GJS · PROFILS DE MOUVEMENT
   Calculé une fois dans le <head> (attribut data-motion sur <html>) :
     desktop  souris + 1024 px et plus : 3D, WebGL, épinglages, magnétisme
     mobile   tactile ou écran étroit : version allégée mais vivante
     reduced  prefers-reduced-motion : simples fondus, rien de lié au scroll
   ========================================================================== */

export const MQ = Object.freeze({
  reduced: '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 1024px) and (hover: hover) and (pointer: fine)',
});

function compute() {
  if (window.matchMedia(MQ.reduced).matches) return 'reduced';
  return window.matchMedia(MQ.desktop).matches ? 'desktop' : 'mobile';
}

export const profile = document.documentElement.getAttribute('data-motion') || compute();
document.documentElement.setAttribute('data-motion', profile);

export const isDesktop = profile === 'desktop';
export const isReduced = profile === 'reduced';

export const saveData = () => Boolean(navigator.connection && navigator.connection.saveData);

export function canWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ok = Boolean(gl);
    if (gl && gl.getExtension('WEBGL_lose_context')) gl.getExtension('WEBGL_lose_context').loseContext();
    return ok;
  } catch {
    return false;
  }
}

/* Si l'utilisateur active « réduire les animations » en cours de visite,
   on recharge : le site repart directement dans le bon profil. */
window.matchMedia(MQ.reduced).addEventListener('change', () => window.location.reload());
