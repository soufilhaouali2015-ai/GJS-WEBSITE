/* ==========================================================================
   GJS · FORMULAIRES DE DEMANDE (Contact et page Services)
   Une seule logique pour les deux : mêmes règles de validation et mêmes
   messages, même champ piège anti-spam (« website »), même envoi POST JSON
   vers CONFIG.FORM_ENDPOINT (Formspree, Make…) avec repli « mailto » si aucun
   endpoint n'est configuré, et même écran de succès (tampon « Reçu ! »).
   ========================================================================== */

import { CONFIG } from '../config.js';
import { env, $, $$, announce } from './utils.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^[0-9+().\s-]{6,20}$/;
export const MIN_MESSAGE = 20;

export const MESSAGES = {
  besoins: () => 'Choisissez au moins un service. « Je ne sais pas encore » est une réponse valable.',
  besoinsCourt: () => 'Choisissez au moins un service.',
  budget: () => 'Indiquez une fourchette de budget. « Je ne sais pas encore » est une réponse valable.',
  delai: () => 'Indiquez un délai, même approximatif.',
  nom: () => 'Indiquez votre nom (2 caractères minimum).',
  email: (v) => (v ? 'Cette adresse semble incomplète. Vérifiez le @ et le domaine (ex. nom@entreprise.fr).' : 'Indiquez votre email pour que l’on puisse vous répondre.'),
  telephone: () => 'Ce numéro semble incorrect : chiffres, espaces, +, tirets et parenthèses uniquement.',
  message: (v) => `Décrivez votre projet en ${MIN_MESSAGE} caractères minimum (encore ${Math.max(0, MIN_MESSAGE - v.trim().length)}).`,
  consentement: () => 'Votre accord est nécessaire pour que nous puissions traiter votre demande.',
};

export function validate(form, name) {
  const inputs = $$(`[name="${name}"]`, form);
  if (!inputs.length) return '';
  const first = inputs[0];
  if (name === 'besoins') {
    if (inputs.some((i) => i.checked)) return '';
    // Sans case « Je ne sais pas encore », le message ne la mentionne pas
    return form.querySelector('[name="besoins"][value="autre"]') ? MESSAGES.besoins() : MESSAGES.besoinsCourt();
  }
  if (first.type === 'radio') return inputs.some((i) => i.checked) ? '' : MESSAGES[name]();
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

export function showError(form, name, message) {
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

export function check(form, selector) {
  const input = form.querySelector(selector);
  if (input) input.checked = true;
  return Boolean(input);
}

/** Coche les services passés dans l'URL (?besoins=site,seo). */
export function prefillBesoins(form, params = new URLSearchParams(window.location.search)) {
  let filled = false;
  params.getAll('besoins').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean).forEach((value) => {
    filled = check(form, `input[name="besoins"][value="${CSS.escape(value)}"]`) || filled;
  });
  return filled;
}

export function labelOf(form, name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
  const box = input && input.nextElementSibling;
  return box ? box.textContent.replace(/\s+/g, ' ').trim() : value;
}

export function collect(form) {
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

export function mailtoFallback(data) {
  const lines = [
    `Services : ${data.besoins_libelles.join(', ')}`,
    data.budget_libelle ? `Budget : ${data.budget_libelle}` : '',
    data.delai_libelle ? `Délai : ${data.delai_libelle}` : '',
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

export async function send(data) {
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

export function showSuccess(form, success, viaMail) {
  const stamp = $('[data-success-stamp]', success);
  if (viaMail) {
    if (stamp) stamp.textContent = 'Encore un clic !';
    $('[data-success-title]', success).textContent = 'Votre messagerie prend le relais.';
    $('[data-success-text]', success).textContent = `Votre demande est pré-remplie dans un nouvel email : il ne reste qu’à cliquer sur « Envoyer ». Rien ne s’est ouvert ? Écrivez-nous à ${CONFIG.EMAIL}.`;
  }
  form.hidden = true;
  success.hidden = false;
  // Le tampon « Reçu ! » s'écrase sur le panneau, qui encaisse une petite secousse
  if (stamp && window.gsap && !env.reducedMotion) {
    import('./motion.js').then(({ stampTimeline }) => stampTimeline(stamp, { rotation: -4, from: 2.2, shake: success }));
  }
  success.focus({ preventScroll: true });
  success.scrollIntoView({ block: 'center', behavior: env.reducedMotion ? 'auto' : 'smooth' });
  announce(viaMail ? 'Votre messagerie s’ouvre avec la demande pré-remplie.' : 'Demande envoyée. Nous vous répondons sous 24 heures.', 'assertive');
}

/** Résumé des erreurs (liens vers chaque champ), affiché en haut du formulaire. */
export function renderSummary(errors, invalid) {
  if (!invalid.length) { errors.hidden = true; errors.textContent = ''; return; }
  errors.hidden = false;
  errors.innerHTML = `<p><strong>${invalid.length > 1 ? `${invalid.length} points à corriger` : 'Un point à corriger'} :</strong></p><ul>${invalid.map(({ name, msg }) => `<li><a href="#" data-fix="${name}">${msg}</a></li>`).join('')}</ul>`;
}

/** Un lien du résumé d'erreurs place le focus sur le champ concerné. */
export function bindSummary(form, errors) {
  errors.addEventListener('click', (e) => {
    const link = e.target.closest('[data-fix]');
    if (!link) return;
    e.preventDefault();
    const target = form.querySelector(`[name="${link.dataset.fix}"]`);
    if (target) target.focus();
  });
}

/** Envoi commun : piège à robots, repli mailto ou POST, puis succès ou message d'erreur. */
export async function submitRequest({ form, success, errors, submit, submitLabel, label = 'Envoyer ma demande' }) {
  const data = collect(form);
  // Champ piège rempli : un robot. On simule un succès sans rien envoyer.
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
  submitLabel.textContent = label;
  if (ok) {
    showSuccess(form, success, false);
  } else {
    errors.hidden = false;
    errors.innerHTML = `<p><strong>L’envoi n’a pas abouti.</strong> Votre connexion a peut-être coupé. Réessayez, ou écrivez-nous directement : <a href="mailto:${CONFIG.EMAIL}">${CONFIG.EMAIL}</a>. Vos réponses sont conservées.</p>`;
    announce('L’envoi n’a pas abouti. Réessayez ou écrivez-nous par email.', 'assertive');
    errors.setAttribute('tabindex', '-1');
    errors.focus();
  }
}

/** La carte du formulaire change de hauteur (étapes, erreurs, succès) : les
    déclencheurs d'animation placés plus bas dans la page sont recalculés. */
export function refreshOnResize(el) {
  if (!el || !window.ScrollTrigger || !('ResizeObserver' in window)) return;
  let last = el.offsetHeight;
  let timer = 0;
  new ResizeObserver(() => {
    if (el.offsetHeight === last) return;
    last = el.offsetHeight;
    clearTimeout(timer);
    timer = setTimeout(() => window.ScrollTrigger.refresh(), 150);
  }).observe(el);
}

/** Validation en direct : au changement pour les choix, à la frappe après un premier passage. */
export function liveValidation(form, touched, counter) {
  form.addEventListener('change', (e) => {
    const { name, type } = e.target;
    if (!name || name === 'website') return;
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
}
