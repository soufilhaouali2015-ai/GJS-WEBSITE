/* ==========================================================================
   GJS · CONFIGURATEUR (page Services)
   Cochez des services : le prix de départ cumulé s'affiche (données de
   services.js). Le bouton ouvre le formulaire de contact pré-rempli.
   Sans JS, le formulaire GET envoie quand même les choix à contact.html.
   ========================================================================== */

import { $, $$ } from '../core/utils.js';
import { SERVICES, formatEuros } from '../services.js';

export default function init() {
  const form = $('[data-configurator]');
  if (!form) return;
  const estimate = $('[data-config-estimate]', form);
  const detail = $('[data-config-detail]', form);
  const submit = $('[data-config-submit]', form);

  const render = () => {
    const picked = $$('input[name="besoins"]:checked', form)
      .map((input) => SERVICES.find((s) => s.id === input.value))
      .filter(Boolean);
    if (!picked.length) {
      estimate.textContent = 'Cochez un ou plusieurs services';
      detail.textContent = 'Le prix de départ s’affiche ici, hors taxes.';
      submit.setAttribute('aria-disabled', 'true');
      return;
    }
    const setup = picked.reduce((sum, s) => sum + s.price.setup, 0);
    const monthly = picked.reduce((sum, s) => sum + s.price.monthly, 0);
    const parts = [];
    if (setup) parts.push(`${formatEuros(setup)} HT`);
    if (monthly) parts.push(`${formatEuros(monthly)} HT/mois`);
    estimate.textContent = `À partir de ${parts.join(' + ')}`;
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
