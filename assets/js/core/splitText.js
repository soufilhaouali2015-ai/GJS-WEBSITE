/* ==========================================================================
   GJS — SPLITTEXT ACCESSIBLE
   Les lecteurs d'écran lisent une copie .sr-only du texte original ; la version
   découpée (lignes / mots / caractères) est en aria-hidden. Fonctionne pour
   tous les éléments (titres, paragraphes) contrairement à aria-label, interdit
   sur certains rôles (paragraph, generic).
   ========================================================================== */

const { SplitText } = window;

function prepare(el) {
  if (el._gjsSplitTarget) return el._gjsSplitTarget;
  const text = (el.getAttribute('data-split-label') || el.textContent).replace(/\s+/g, ' ').trim();
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const target = document.createElement('span');
  target.className = 'split-target';
  target.setAttribute('aria-hidden', 'true');
  while (el.firstChild) target.appendChild(el.firstChild);
  el.append(sr, target);
  el._gjsSplitTarget = target;
  return target;
}

/**
 * Découpe `el`. type : 'lines' | 'words' | 'chars' (les mots et lignes sont
 * toujours conservés pour un retour à la ligne correct).
 * onSplit(self) peut renvoyer une animation : elle sera recréée sans saut
 * si le texte est redécoupé (chargement des polices, redimensionnement).
 */
export function split(el, { type = 'lines', mask = 'lines', onSplit, autoSplit = true } = {}) {
  const target = prepare(el);
  const types = {
    lines: 'lines',
    words: 'lines,words',
    chars: 'lines,words,chars',
  };
  return SplitText.create(target, {
    type: types[type] || type,
    mask,
    aria: 'none',
    autoSplit,
    linesClass: 'line',
    wordsClass: 'word',
    charsClass: 'char',
    onSplit,
  });
}
