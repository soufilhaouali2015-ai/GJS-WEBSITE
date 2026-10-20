/* ==========================================================================
   GJS · PAGE CONTACT
   Formulaire en 3 étapes : progression, validation accessible, pré-remplissage
   depuis l'URL (?besoins=site,seo&budget=…&delai=…), champ piège anti-spam,
   consentement RGPD, envoi POST JSON vers CONFIG.FORM_ENDPOINT (Formspree, Make…)
   ou repli « mailto » si aucun endpoint n'est configuré (voir core/forms.js).
   ========================================================================== */

import { env, $, $$, announce } from '../core/utils.js';
import { validate, showError, check, prefillBesoins, renderSummary, bindSummary, submitRequest, liveValidation, refreshOnResize } from '../core/forms.js';

const TOTAL = 3;
const STEP_NAMES = ['vos besoins', 'votre budget et votre délai', 'vos coordonnées'];

const FIELDS_BY_STEP = {
  1: ['besoins'],
  2: ['budget', 'delai'],
  3: ['nom', 'email', 'telephone', 'message', 'consentement'],
};

const HORIZON_TO_DELAI = { urgent: 'urgent', '1-3-mois': '1-3-mois', '3-6-mois': '3-6-mois', 'plus-tard': 'plus-tard' };

function prefill(form) {
  const params = new URLSearchParams(window.location.search);
  let filled = prefillBesoins(form, params);
  const budget = params.get('budget');
  if (budget) filled = check(form, `input[name="budget"][value="${CSS.escape(budget)}"]`) || filled;
  const delai = HORIZON_TO_DELAI[params.get('horizon')] || params.get('delai');
  if (delai) filled = check(form, `input[name="delai"][value="${CSS.escape(delai)}"]`) || filled;
  return filled;
}

function initForm() {
  const form = $('[data-contact-form]');
  if (!form) return;
  const steps = $$('[data-step]', form);
  const prev = $('[data-form-prev]', form);
  const next = $('[data-form-next]', form);
  const submit = $('[data-form-submit]', form);
  const submitLabel = $('[data-submit-label]', submit);
  const labels = $$('[data-step-label]', form);
  const status = $('[data-form-status]', form);
  const errors = $('[data-form-errors]', form);
  const success = $('[data-contact-success]');
  const counter = $('[data-char-count]', form);
  const card = form.closest('.form-card') || form;
  const touched = new Set();
  let current = 1;

  // Le JS prend la main : mode étapes (sans JS, tout reste visible et part en mailto)
  form.noValidate = true;
  form.removeAttribute('action');
  form.removeAttribute('enctype');
  form.classList.add('is-stepped');
  steps.forEach((s, i) => { s.hidden = i > 0; s.setAttribute('tabindex', '-1'); });

  const render = () => {
    prev.hidden = current === 1;
    next.hidden = current === TOTAL;
    submit.hidden = current !== TOTAL;
    labels.forEach((l, i) => {
      l.classList.toggle('is-current', i + 1 === current);
      l.classList.toggle('is-done', i + 1 < current);
      if (i + 1 === current) l.setAttribute('aria-current', 'step');
      else l.removeAttribute('aria-current');
    });
    status.textContent = `Étape ${current} sur ${TOTAL} : ${STEP_NAMES[current - 1]}.`;
  };

  const validateStep = (n) => {
    const invalid = [];
    FIELDS_BY_STEP[n].forEach((name) => {
      const msg = validate(form, name);
      showError(form, name, msg);
      touched.add(name);
      if (msg) invalid.push({ name, msg });
    });
    return invalid;
  };

  const focusFirstInvalid = (invalid) => {
    const target = invalid.length && form.querySelector(`[name="${invalid[0].name}"]`);
    if (target) target.focus();
  };

  const goTo = (n) => {
    const dir = n > current ? 1 : -1;
    steps[current - 1].hidden = true;
    current = n;
    steps[current - 1].hidden = false;
    // L'étape suivante arrive en glissant depuis le côté où l'on va (transform et opacity)
    if (window.gsap && !env.reducedMotion) {
      window.gsap.fromTo(steps[current - 1], { x: 48 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform,opacity' });
    }
    renderSummary(errors, []);
    render();
    steps[current - 1].focus({ preventScroll: true });
    const top = card.getBoundingClientRect().top;
    if (top < 0) card.scrollIntoView({ block: 'start', behavior: env.reducedMotion ? 'auto' : 'smooth' });
  };

  const tryNext = () => {
    const invalid = validateStep(current);
    if (invalid.length) {
      renderSummary(errors, invalid);
      announce(invalid[0].msg, 'assertive');
      focusFirstInvalid(invalid);
      return;
    }
    if (current < TOTAL) goTo(current + 1);
  };

  next.addEventListener('click', tryNext);
  prev.addEventListener('click', () => { if (current > 1) goTo(current - 1); });

  liveValidation(form, touched, counter);
  bindSummary(form, errors);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current < TOTAL) { tryNext(); return; }
    // Re-vérification complète (au cas où une étape aurait été contournée)
    for (let n = 1; n <= TOTAL; n += 1) {
      const invalid = validateStep(n);
      if (invalid.length) {
        if (n !== current) goTo(n);
        renderSummary(errors, invalid);
        announce(invalid[0].msg, 'assertive');
        focusFirstInvalid(invalid);
        return;
      }
    }
    await submitRequest({ form, success, errors, submit, submitLabel });
  });

  const filled = prefill(form);
  render();
  refreshOnResize(card);
  window.ScrollTrigger?.refresh();
  if (filled) announce('Formulaire pré-rempli avec vos choix.');
}

export default function init() {
  initForm();
}
