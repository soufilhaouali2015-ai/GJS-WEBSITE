/* ==========================================================================
   GJS — PAGE CONTACT
   Formulaire multi-étapes : progression, validation en direct accessible,
   pré-remplissage depuis le configurateur (paramètres d'URL), honeypot,
   consentement RGPD, envoi fetch vers CONFIG.FORM_ENDPOINT (Formspree, Make,
   n8n…) ou repli « mailto » si aucun endpoint n'est configuré.
   ========================================================================== */

import { CONFIG } from '../config.js';
import { env, $, $$, announce, createShip } from '../core/utils.js';

const { gsap } = window;

const TOTAL = 4;
const STEP_NAMES = ['vos besoins', 'votre budget', 'votre délai', 'vos coordonnées'];
const HORIZON_TO_DELAY = { urgent: 'urgent', '1-3-mois': '1-3-mois', 'plus-tard': 'plus-tard' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+().\s-]{6,20}$/;

const MESSAGES = {
  besoins: () => 'Choisissez au moins un besoin (même « Autre » fait l’affaire).',
  budget: () => 'Indiquez une fourchette de budget — « Je ne sais pas encore » est une réponse valable.',
  delai: () => 'Indiquez un délai, même approximatif.',
  nom: () => 'Indiquez votre nom (2 caractères minimum).',
  email: (v) => (v ? 'Cette adresse semble incomplète : vérifiez le @ et le domaine (ex. nom@entreprise.fr).' : 'Indiquez votre email pour que l’on puisse vous répondre.'),
  telephone: () => 'Ce numéro semble incorrect : chiffres, espaces, +, tirets et parenthèses uniquement.',
  site: () => 'Cette adresse de site semble incorrecte (ex. https://votre-site.fr).',
  message: (v) => `Décrivez votre projet en 20 caractères minimum (encore ${Math.max(0, 20 - v.trim().length)}).`,
  consentement: () => 'Votre accord est nécessaire pour que nous puissions traiter votre demande.',
};

const FIELDS_BY_STEP = {
  1: ['besoins'],
  2: ['budget'],
  3: ['delai'],
  4: ['nom', 'email', 'telephone', 'site', 'message', 'consentement'],
};

function validate(form, name) {
  const inputs = $$(`[name="${name}"]`, form);
  if (!inputs.length) return '';
  const first = inputs[0];
  if (first.type === 'checkbox' && name === 'besoins') return inputs.some((i) => i.checked) ? '' : MESSAGES.besoins();
  if (first.type === 'radio') return inputs.some((i) => i.checked) ? '' : MESSAGES[name]();
  if (first.type === 'checkbox') return first.checked ? '' : MESSAGES[name]();
  const value = first.value.trim();
  switch (name) {
    case 'nom': return value.length >= 2 ? '' : MESSAGES.nom();
    case 'email': return EMAIL_RE.test(value) ? '' : MESSAGES.email(value);
    case 'telephone': return !value || PHONE_RE.test(value) ? '' : MESSAGES.telephone();
    case 'site': {
      if (!value) return '';
      try { const u = new URL(value); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? '' : MESSAGES.site(); } catch { return MESSAGES.site(); }
    }
    case 'message': return value.length >= 20 ? '' : MESSAGES.message(value);
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

function prefill(form) {
  const params = new URLSearchParams(window.location.search);
  let filled = false;
  const needs = params.getAll('besoins').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  needs.forEach((value) => {
    const input = form.querySelector(`input[name="besoins"][value="${CSS.escape(value)}"]`);
    if (input) { input.checked = true; filled = true; }
  });
  const goal = params.get('objectif');
  if (goal) {
    const input = form.querySelector(`input[name="objectif"][value="${CSS.escape(goal)}"]`);
    if (input) { input.checked = true; filled = true; }
  }
  const delay = HORIZON_TO_DELAY[params.get('horizon')] || params.get('delai');
  if (delay) {
    const input = form.querySelector(`input[name="delai"][value="${CSS.escape(delay)}"]`);
    if (input) { input.checked = true; filled = true; }
  }
  const code = params.get('code');
  if (code) {
    const input = form.querySelector('input[name="code"]');
    if (input) input.value = code.slice(0, 32);
  }
  return filled;
}

function collect(form) {
  const data = new FormData(form);
  return {
    besoins: data.getAll('besoins'),
    objectif: data.get('objectif') || '',
    budget: data.get('budget') || '',
    delai: data.get('delai') || '',
    nom: (data.get('nom') || '').trim(),
    email: (data.get('email') || '').trim(),
    entreprise: (data.get('entreprise') || '').trim(),
    telephone: (data.get('telephone') || '').trim(),
    site: (data.get('site') || '').trim(),
    message: (data.get('message') || '').trim(),
    code: (data.get('code') || '').trim(),
    consentement: data.get('consentement') === 'oui',
    page: window.location.href,
    date: new Date().toISOString(),
    _subject: `Nouveau projet — ${(data.get('nom') || '').trim()}`,
  };
}

function labelOf(form, name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
  const box = input && input.nextElementSibling;
  if (!box) return value;
  const clone = box.cloneNode(true);
  clone.querySelectorAll('.choice__index, .choice__mark').forEach((n) => n.remove());
  return clone.textContent.trim();
}

function mailtoFallback(form, data) {
  const lines = [
    `Besoins : ${data.besoins.map((v) => labelOf(form, 'besoins', v)).join(', ')}`,
    data.objectif ? `Objectif : ${labelOf(form, 'objectif', data.objectif)}` : '',
    `Budget : ${labelOf(form, 'budget', data.budget)}`,
    `Délai : ${labelOf(form, 'delai', data.delai)}`,
    '',
    `Nom : ${data.nom}`,
    `Email : ${data.email}`,
    data.entreprise ? `Entreprise : ${data.entreprise}` : '',
    data.telephone ? `Téléphone : ${data.telephone}` : '',
    data.site ? `Site : ${data.site}` : '',
    data.code ? `Code : ${data.code}` : '',
    '',
    data.message,
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
  const href = `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent(data._subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  window.location.href = href;
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

/* ---------- Copie de l'email -------------------------------------------- */

function initCopy(scope, root) {
  const btn = $('[data-copy]', root);
  const feedback = $('[data-copy-feedback]', root);
  if (!btn) return;
  let timer = 0;
  scope.on(btn, 'click', async () => {
    const value = btn.dataset.copy || CONFIG.EMAIL;
    try {
      await navigator.clipboard.writeText(value);
      feedback.textContent = 'Copié ✓';
      feedback.classList.add('is-copied');
      clearTimeout(timer);
      timer = setTimeout(() => { feedback.textContent = 'Cliquez pour copier'; feedback.classList.remove('is-copied'); }, 2200);
    } catch {
      window.location.href = `mailto:${value}`;
    }
  });
  scope.cleanup(() => clearTimeout(timer));
}

/* ---------- Formulaire multi-étapes ------------------------------------- */

function initForm(scope, root) {
  const form = $('[data-contact-form]', root);
  if (!form) return;
  const steps = $$('[data-step]', form);
  const prev = $('[data-form-prev]', form);
  const next = $('[data-form-next]', form);
  const submit = $('[data-form-submit]', form);
  const bar = $('[data-form-bar]', form);
  const labels = $$('[data-step-label]', form);
  const status = $('[data-form-status]', form);
  const errors = $('[data-form-errors]', form);
  const success = $('[data-contact-success]', root);
  const counter = $('[data-char-count]', form);
  const message = $('#f-message', form);
  const touched = new Set();
  let current = 1;

  // Le JS prend la main : mode étapes (sans JS, tout reste visible et le formulaire part en mailto)
  form.removeAttribute('action');
  form.classList.add('is-stepped');
  steps.forEach((s, i) => { s.hidden = i > 0; s.setAttribute('tabindex', '-1'); });

  const render = () => {
    prev.hidden = current === 1;
    next.hidden = current === TOTAL;
    submit.hidden = current !== TOTAL;
    bar.style.transform = `scaleX(${current / TOTAL})`;
    labels.forEach((l, i) => {
      l.classList.toggle('is-current', i + 1 === current);
      l.classList.toggle('is-done', i + 1 < current);
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
    if (!invalid.length) { errors.hidden = true; errors.innerHTML = ''; return; }
    errors.hidden = false;
    errors.innerHTML = `<p><strong>${invalid.length > 1 ? `${invalid.length} points à corriger` : 'Un point à corriger'} :</strong></p><ul>${invalid.map(({ name, msg }) => {
      const target = form.querySelector(`[name="${name}"]`);
      return `<li><a href="#${target ? target.id || '' : ''}" data-fix="${name}">${msg}</a></li>`;
    }).join('')}</ul>`;
  };

  const focusFirstInvalid = (invalid) => {
    if (!invalid.length) return;
    const target = form.querySelector(`[name="${invalid[0].name}"]`);
    if (target) target.focus();
  };

  const goTo = (n) => {
    const from = steps[current - 1];
    const to = steps[n - 1];
    const dir = n > current ? 1 : -1;
    current = n;
    showSummary([]);
    const swap = () => {
      from.hidden = true;
      to.hidden = false;
      render();
      to.focus({ preventScroll: true });
      const top = form.getBoundingClientRect().top + window.scrollY - 120;
      if (window.scrollY > top) window.scrollTo({ top, behavior: env.reducedMotion ? 'auto' : 'smooth' });
      if (!env.reducedMotion) gsap.fromTo(to, { autoAlpha: 0, x: 40 * dir }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out' });
    };
    if (env.reducedMotion) swap();
    else gsap.to(from, { autoAlpha: 0, x: -30 * dir, duration: 0.25, ease: 'power2.in', onComplete: () => { gsap.set(from, { clearProps: 'all' }); swap(); } });
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

  scope.on(next, 'click', tryNext);
  scope.on(prev, 'click', () => { if (current > 1) goTo(current - 1); });

  // Validation en direct : au changement pour les choix, à la frappe après un premier passage
  scope.on(form, 'change', (e) => {
    const { name } = e.target;
    if (!name || name === 'website') return;
    if (e.target.type === 'checkbox' || e.target.type === 'radio' || touched.has(name)) showError(form, name, validate(form, name));
  });
  scope.on(form, 'input', (e) => {
    const { name } = e.target;
    if (name === 'message' && counter) counter.textContent = String(e.target.value.length);
    if (touched.has(name)) showError(form, name, validate(form, name));
  });
  scope.on(form, 'focusout', (e) => {
    const { name, type } = e.target;
    if (!name || type === 'checkbox' || type === 'radio' || name === 'website') return;
    if (name === 'site' && e.target.value && !/^https?:\/\//i.test(e.target.value)) e.target.value = `https://${e.target.value.trim()}`;
    if (e.target.value || touched.has(name)) {
      touched.add(name);
      showError(form, name, validate(form, name));
    }
  });
  scope.on(errors, 'click', (e) => {
    const link = e.target.closest('[data-fix]');
    if (!link) return;
    e.preventDefault();
    const target = form.querySelector(`[name="${link.dataset.fix}"]`);
    if (target) target.focus();
  });

  scope.on(form, 'submit', async (e) => {
    e.preventDefault();
    if (current < TOTAL) { tryNext(); return; }
    // Re-vérification complète (au cas où une étape aurait été contournée)
    for (let n = 1; n <= TOTAL; n += 1) {
      const invalid = validateStep(n);
      if (invalid.length) {
        if (n !== current) { steps.forEach((s, i) => { s.hidden = i !== n - 1; }); current = n; render(); }
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
      mailtoFallback(form, data);
      showSuccess(form, success, true);
      return;
    }

    form.classList.add('is-sending');
    submit.disabled = true;
    submit.firstChild.textContent = 'Envoi en cours… ';
    announce('Envoi en cours.');
    const ok = await send(data);
    form.classList.remove('is-sending');
    submit.disabled = false;
    submit.firstChild.textContent = 'Envoyer ma demande ';
    if (ok) {
      showSuccess(form, success, false);
    } else {
      errors.hidden = false;
      errors.innerHTML = `<p><strong>L’envoi n’a pas abouti.</strong> Votre connexion a peut-être coupé. Réessayez, ou écrivez-nous directement : <a href="mailto:${CONFIG.EMAIL}">${CONFIG.EMAIL}</a>. Vos réponses sont conservées.</p>`;
      announce('L’envoi n’a pas abouti. Réessayez ou écrivez-nous par email.', 'assertive');
      errors.setAttribute('tabindex', '-1');
      errors.focus();
    }
  });

  const filled = prefill(form);
  render();
  if (filled) announce('Formulaire pré-rempli avec les choix du configurateur.');
}

/* ---------- Succès : le vaisseau décolle avec le message ----------------- */

function showSuccess(form, success, viaMail) {
  if (viaMail) {
    $('[data-success-title]', success).innerHTML = 'Votre messagerie <em class="serif">prend le relais</em>.';
    $('[data-success-text]', success).textContent = 'Votre demande est pré-remplie dans un nouvel email : il ne reste qu’à cliquer sur « Envoyer ». Rien ne s’est ouvert ? Écrivez-nous à ' + CONFIG.EMAIL + '.';
  }
  form.hidden = true;
  success.hidden = false;
  success.focus({ preventScroll: true });
  announce(viaMail ? 'Votre client mail s’ouvre avec la demande pré-remplie.' : 'Message envoyé. Nous revenons vers vous sous 24 heures ouvrées.', 'assertive');
  const ship = $('.contact-success__ship', success);
  if (env.reducedMotion || !ship) return;
  const flyer = createShip('contact-flyer');
  const rect = ship.getBoundingClientRect();
  Object.assign(flyer.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, zIndex: 'var(--z-egg)', pointerEvents: 'none' });
  document.body.appendChild(flyer);
  gsap.set(ship, { autoAlpha: 0 });
  gsap.timeline({ onComplete: () => { flyer.remove(); gsap.to(ship, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }); } })
    .fromTo(flyer, { rotation: -90, y: 60, x: 0 }, { y: 0, duration: 0.6, ease: 'power2.out' })
    .to(flyer, { y: -window.innerHeight - 200, scale: 0.6, duration: 1.1, ease: 'power3.in' })
    .set(ship, { y: 40 });
  gsap.from(success.children, { y: 30, autoAlpha: 0, stagger: 0.08, duration: 0.9, ease: 'expo.out', delay: 0.3 });
}

/* ---------- Cycle de vie --------------------------------------------------- */

export default {
  init(scope, root) {
    initForm(scope, root);
    initCopy(scope, root);
  },
  destroy() {},
};
