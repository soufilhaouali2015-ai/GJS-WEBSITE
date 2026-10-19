/* ==========================================================================
   GJS · PAGE CONTACT
   Formulaire en 3 étapes : progression, validation accessible, pré-remplissage
   depuis l'URL (?besoins=site,seo&budget=…&delai=…&offre=lancement), honeypot,
   consentement RGPD, envoi POST JSON vers CONFIG.FORM_ENDPOINT (Formspree, Make…)
   ou repli « mailto » si aucun endpoint n'est configuré.
   ========================================================================== */

import { CONFIG } from '../config.js';
import { env, $, $$, announce } from '../core/utils.js';

const TOTAL = 3;
const STEP_NAMES = ['vos besoins', 'votre budget et votre délai', 'vos coordonnées'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+().\s-]{6,20}$/;
const MIN_MESSAGE = 20;

const MESSAGES = {
  besoins: () => 'Choisissez au moins un service. « Je ne sais pas encore » est une réponse valable.',
  budget: () => 'Indiquez une fourchette de budget. « Je ne sais pas encore » est une réponse valable.',
  delai: () => 'Indiquez un délai, même approximatif.',
  nom: () => 'Indiquez votre nom (2 caractères minimum).',
  email: (v) => (v ? 'Cette adresse semble incomplète. Vérifiez le @ et le domaine (ex. nom@entreprise.fr).' : 'Indiquez votre email pour que l’on puisse vous répondre.'),
  telephone: () => 'Ce numéro semble incorrect : chiffres, espaces, +, tirets et parenthèses uniquement.',
  message: (v) => `Décrivez votre projet en ${MIN_MESSAGE} caractères minimum (encore ${Math.max(0, MIN_MESSAGE - v.trim().length)}).`,
  consentement: () => 'Votre accord est nécessaire pour que nous puissions traiter votre demande.',
};

const FIELDS_BY_STEP = {
  1: ['besoins'],
  2: ['budget', 'delai'],
  3: ['nom', 'email', 'telephone', 'message', 'consentement'],
};

const HORIZON_TO_DELAI = { urgent: 'urgent', '1-3-mois': '1-3-mois', '3-6-mois': '3-6-mois', 'plus-tard': 'plus-tard' };

function validate(form, name) {
  const inputs = $$(`[name="${name}"]`, form);
  if (!inputs.length) return '';
  const first = inputs[0];
  if (name === 'besoins' || first.type === 'radio') return inputs.some((i) => i.checked) ? '' : MESSAGES[name]();
  if (first.type === 'checkbox') return first.checked ? '' : MESSAGES[name]();
  const value = first.value.trim();
  switch (name) {
    case 'nom': return value.length >= 2 ? '' : MESSAGES.nom();
    case 'email': return EMAIL_RE.test(value) ? '' : MESSAGES.email(value);
    case 'telephone': return !value || PHONE_RE.test(value) ? '' : MESSAGES.telephone();
    case 'message': return value.length >= MIN_MESSAGE ? '' : MESSAGES.message(value);
    default: return '';
  }
}

function showError(form, name, message) {
  const inputs = $$(`[name="${name}"]`, form);
  const box = $(`[data-error-for="${name}"]`, form);
  const group = form.querySelector(`[data-group="${name}"]`);
  inputs.forEach((i) => {
    if (message) i.setAttribute('aria-invalid', 'true');
    else i.removeAttribute('aria-invalid');
  });
  if (group) group.toggleAttribute('data-invalid', Boolean(message));
  if (box) box.textContent = message;
}

function check(form, selector) {
  const input = form.querySelector(selector);
  if (input) input.checked = true;
  return Boolean(input);
}

function prefill(form) {
  const params = new URLSearchParams(window.location.search);
  let filled = false;
  params.getAll('besoins').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean).forEach((value) => {
    filled = check(form, `input[name="besoins"][value="${CSS.escape(value)}"]`) || filled;
  });
  const budget = params.get('budget');
  if (budget) filled = check(form, `input[name="budget"][value="${CSS.escape(budget)}"]`) || filled;
  const delai = HORIZON_TO_DELAI[params.get('horizon')] || params.get('delai');
  if (delai) filled = check(form, `input[name="delai"][value="${CSS.escape(delai)}"]`) || filled;
  if (params.get('offre') === 'lancement') filled = check(form, 'input[name="offre_lancement"]') || filled;
  return filled;
}

function labelOf(form, name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
  const box = input && input.nextElementSibling;
  return box ? box.textContent.replace(/\s+/g, ' ').trim() : value;
}

function collect(form) {
  const data = new FormData(form);
  const besoins = data.getAll('besoins');
  const nom = (data.get('nom') || '').trim();
  return {
    besoins,
    besoins_libelles: besoins.map((v) => labelOf(form, 'besoins', v)),
    budget: data.get('budget') || '',
    budget_libelle: data.get('budget') ? labelOf(form, 'budget', data.get('budget')) : '',
    delai: data.get('delai') || '',
    delai_libelle: data.get('delai') ? labelOf(form, 'delai', data.get('delai')) : '',
    offre_lancement: data.get('offre_lancement') === 'oui',
    nom,
    email: (data.get('email') || '').trim(),
    telephone: (data.get('telephone') || '').trim(),
    entreprise: (data.get('entreprise') || '').trim(),
    message: (data.get('message') || '').trim(),
    consentement: data.get('consentement') === 'oui',
    page: window.location.href,
    date: new Date().toISOString(),
    _subject: `Nouvelle demande de devis : ${nom}`,
  };
}

function mailtoFallback(data) {
  const lines = [
    `Services : ${data.besoins_libelles.join(', ')}`,
    `Budget : ${data.budget_libelle}`,
    `Délai : ${data.delai_libelle}`,
    data.offre_lancement ? 'Intéressé(e) par l’offre de lancement (-40 %)' : '',
    '',
    `Nom : ${data.nom}`,
    `Email : ${data.email}`,
    data.telephone ? `Téléphone : ${data.telephone}` : '',
    data.entreprise ? `Entreprise : ${data.entreprise}` : '',
    '',
    data.message,
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
  window.location.href = `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent(data._subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

async function send(data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(CONFIG.FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function showSuccess(form, success, viaMail) {
  const stamp = $('[data-success-stamp]', success);
  if (viaMail) {
    if (stamp) stamp.textContent = 'Encore un clic\u00a0!';
    $('[data-success-title]', success).textContent = 'Votre messagerie prend le relais.';
    $('[data-success-text]', success).textContent = `Votre demande est pré-remplie dans un nouvel email : il ne reste qu’à cliquer sur « Envoyer ». Rien ne s’est ouvert ? Écrivez-nous à ${CONFIG.EMAIL}.`;
  }
  form.hidden = true;
  success.hidden = false;
  // Le tampon « Reçu ! » s'écrase sur le panneau, qui encaisse une petite secousse
  if (stamp && window.gsap && !env.reducedMotion) {
    import('../core/motion.js').then(({ stampTimeline }) => stampTimeline(stamp, { rotation: -4, from: 2.2, shake: success }));
  }
  success.focus({ preventScroll: true });
  success.scrollIntoView({ block: 'center', behavior: env.reducedMotion ? 'auto' : 'smooth' });
  announce(viaMail ? 'Votre messagerie s’ouvre avec la demande pré-remplie.' : 'Demande envoyée. Nous vous répondons sous 24 heures.', 'assertive');
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

  const showSummary = (invalid) => {
    if (!invalid.length) { errors.hidden = true; errors.textContent = ''; return; }
    errors.hidden = false;
    errors.innerHTML = `<p><strong>${invalid.length > 1 ? `${invalid.length} points à corriger` : 'Un point à corriger'} :</strong></p><ul>${invalid.map(({ name, msg }) => `<li><a href="#" data-fix="${name}">${msg}</a></li>`).join('')}</ul>`;
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
    showSummary([]);
    render();
    steps[current - 1].focus({ preventScroll: true });
    const top = card.getBoundingClientRect().top;
    if (top < 0) card.scrollIntoView({ block: 'start', behavior: env.reducedMotion ? 'auto' : 'smooth' });
  };

  const tryNext = () => {
    const invalid = validateStep(current);
    if (invalid.length) {
      showSummary(invalid);
      announce(invalid[0].msg, 'assertive');
      focusFirstInvalid(invalid);
      return;
    }
    if (current < TOTAL) goTo(current + 1);
  };

  next.addEventListener('click', tryNext);
  prev.addEventListener('click', () => { if (current > 1) goTo(current - 1); });

  // Validation en direct : au changement pour les choix, à la frappe après un premier passage
  form.addEventListener('change', (e) => {
    const { name, type } = e.target;
    if (!name || name === 'website' || name === 'offre_lancement') return;
    if (type === 'checkbox' || type === 'radio' || touched.has(name)) showError(form, name, validate(form, name));
  });
  form.addEventListener('input', (e) => {
    const { name } = e.target;
    if (name === 'message' && counter) counter.textContent = String(e.target.value.length);
    if (touched.has(name)) showError(form, name, validate(form, name));
  });
  form.addEventListener('focusout', (e) => {
    const { name, type, value } = e.target;
    if (!name || type === 'checkbox' || type === 'radio' || name === 'website') return;
    if (value || touched.has(name)) {
      touched.add(name);
      showError(form, name, validate(form, name));
    }
  });
  errors.addEventListener('click', (e) => {
    const link = e.target.closest('[data-fix]');
    if (!link) return;
    e.preventDefault();
    const target = form.querySelector(`[name="${link.dataset.fix}"]`);
    if (target) target.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current < TOTAL) { tryNext(); return; }
    // Re-vérification complète (au cas où une étape aurait été contournée)
    for (let n = 1; n <= TOTAL; n += 1) {
      const invalid = validateStep(n);
      if (invalid.length) {
        if (n !== current) goTo(n);
        showSummary(invalid);
        announce(invalid[0].msg, 'assertive');
        focusFirstInvalid(invalid);
        return;
      }
    }
    const data = collect(form);
    // Honeypot rempli : un robot. On simule un succès sans rien envoyer.
    if (form.querySelector('[name="website"]').value) { showSuccess(form, success, false); return; }

    if (!CONFIG.FORM_ENDPOINT) {
      mailtoFallback(data);
      showSuccess(form, success, true);
      return;
    }

    form.classList.add('is-sending');
    submit.disabled = true;
    submitLabel.textContent = 'Envoi en cours…';
    announce('Envoi en cours.');
    const ok = await send(data);
    form.classList.remove('is-sending');
    submit.disabled = false;
    submitLabel.textContent = 'Envoyer ma demande';
    if (ok) {
      showSuccess(form, success, false);
    } else {
      errors.hidden = false;
      errors.innerHTML = `<p><strong>L’envoi n’a pas abouti.</strong> Votre connexion a peut-être coupé. Réessayez, ou écrivez-nous directement : <a href="mailto:${CONFIG.EMAIL}">${CONFIG.EMAIL}</a>. Vos réponses sont conservées.</p>`;
      announce('L’envoi n’a pas abouti. Réessayez ou écrivez-nous par email.', 'assertive');
      errors.setAttribute('tabindex', '-1');
      errors.focus();
    }
  });

  const filled = prefill(form);
  render();
  if (filled) announce('Formulaire pré-rempli avec vos choix.');
}

export default function init() {
  initForm();
}
