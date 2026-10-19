/* ==========================================================================
   GJS · CONFIGURATEUR (page Services)
   Cochez des services : le prix de départ cumulé s'affiche (données de
   services.js). Le bouton ouvre le formulaire de contact pré-rempli.
   Sans JS, le formulaire GET envoie quand même les choix à contact.html.
   ========================================================================== */

import { $, $$ } from '../core/utils.js';
import { SERVICES, formatEuros } from '../services.js';
import { isReduced } from '../core/profile.js';

const NBSP = '\u00a0';
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/* Le total défile comme un compteur, de l'ancien montant au nouveau.
   Les lecteurs d'écran n'entendent que le texte final (copie masquée à l'écran),
   jamais les chiffres intermédiaires. */
function counter(el) {
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  sr.textContent = el.textContent;
  vis.textContent = el.textContent;
  el.replaceChildren(sr, vis);
  let prev = [];
  let tween = null;
  return (text) => {
    sr.textContent = text;
    const parts = text.split(/(\d[\d\u00a0]*\d|\d)/); // nombres aux indices impairs
    const nums = parts.filter((_, i) => i % 2).map((t) => parseInt(t.replace(/\D/g, ''), 10));
    const from = nums.map((n, i) => (prev[i] !== undefined ? prev[i] : 0));
    prev = nums;
    if (tween) tween.kill();
    const { gsap } = window;
    if (!gsap || isReduced || !nums.length) { vis.textContent = text; return; }
    const o = { t: 0 };
    tween = gsap.to(o, {
      t: 1,
      duration: 0.8,
      ease: 'expo.out',
      onUpdate: () => {
        let k = -1;
        vis.textContent = parts.map((p, i) => {
          if (!(i % 2)) return p;
          k += 1;
          return group(Math.round(from[k] + (nums[k] - from[k]) * o.t));
        }).join('');
      },
      onComplete: () => { vis.textContent = text; },
    });
  };
}

export default function init() {
  const form = $('[data-configurator]');
  if (!form) return;
  const estimate = $('[data-config-estimate]', form);
  const detail = $('[data-config-detail]', form);
  const submit = $('[data-config-submit]', form);
  const show = counter(estimate);

  const render = () => {
    const picked = $$('input[name="besoins"]:checked', form)
      .map((input) => SERVICES.find((s) => s.id === input.value))
      .filter(Boolean);
    if (!picked.length) {
      show('Cochez un ou plusieurs services');
      detail.textContent = 'Le prix de départ s’affiche ici, hors taxes.';
      submit.setAttribute('aria-disabled', 'true');
      return;
    }
    const setup = picked.reduce((sum, s) => sum + s.price.setup, 0);
    const monthly = picked.reduce((sum, s) => sum + s.price.monthly, 0);
    const parts = [];
    if (setup) parts.push(`${formatEuros(setup)} HT`);
    if (monthly) parts.push(`${formatEuros(monthly)} HT/mois`);
    show(`À partir de ${parts.join(' + ')}`);
    const notes = picked.map((s) => s.price.note).filter(Boolean);
    detail.textContent = `${picked.length > 1 ? `${picked.length} services` : picked[0].name}.${notes.length ? ` ${notes.join('. ')}.` : ''} Le devis précis arrive sous 48 h après un échange gratuit.`;
    submit.removeAttribute('aria-disabled');
  };

  form.addEventListener('change', render);
  form.addEventListener('submit', (e) => {
    if (!$('input[name="besoins"]:checked', form)) {
      e.preventDefault();
      detail.textContent = 'Choisissez au moins un service pour continuer.';
      $('input[name="besoins"]', form).focus();
    }
  });
  render();
}
