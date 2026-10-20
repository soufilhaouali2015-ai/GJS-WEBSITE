/* ==========================================================================
   GJS · PAGES LÉGALES
   Exercer vos droits : le formulaire prépare l'email de la demande (aperçu,
   copie du message, ouverture de la messagerie). Rien n'est envoyé par le site.
   Politique de cookies : deux panneaux lisent ce navigateur (le choix de
   cookies en cours, les données du site enregistrées) et permettent de les
   effacer. Sans JS : le formulaire part en mailto, les panneaux restent cachés.
   ========================================================================== */

import { CONFIG } from '../config.js';
import { $, $$, store } from '../core/utils.js';
import { scrollTo } from '../core/scroll.js';
import { EMAIL_RE } from '../core/forms.js';

const DAY = 86400000;
const plain = (s) => s.replace(/[  ]/g, ' ');

const MESSAGES = {
  droit: 'Choisissez le droit que vous souhaitez exercer.',
  nom: 'Indiquez votre nom (2 caractères minimum).',
  emailEmpty: 'Indiquez l’email utilisé avec GJS : il nous permet de retrouver vos données.',
  emailBad: 'Cet email semble incomplet : vérifiez le @ et le domaine (ex. prenom@entreprise.fr).',
};

function selectContents(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Copie de secours (contexte non sécurisé ou presse-papiers refusé). */
function legacyCopy(text, restore) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0' });
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  if (restore) restore.focus({ preventScroll: true });
  return ok;
}

/* ---- Exercer vos droits : l'email de la demande ---------------------------- */

function rightsForm() {
  const form = $('[data-rights-form]');
  if (!form) return;
  const radios = $$('input[name="droit"]', form);
  const group = $('[data-group="droit"]', form);
  const nom = form.elements.nom;
  const email = form.elements.email;
  const details = form.elements.precisions;
  const hint = $('[data-rights-hint]', form);
  const preview = $('[data-rights-preview]', form);
  const subjectOut = $('[data-rights-subject]', form);
  const bodyOut = $('[data-rights-body]', form);
  const copyBtn = $('[data-rights-copy]', form);
  const status = $('[data-rights-status]', form);
  const summary = $('[data-rights-errors]', form);
  const defaultHint = hint ? hint.textContent : '';
  let submitted = false;
  let copyTimer = 0;

  // Le JS prend la main : validation maison, copie possible
  form.noValidate = true;
  if (copyBtn) copyBtn.hidden = false;

  const checked = () => radios.find((r) => r.checked) || null;

  const compose = () => {
    const choice = checked();
    const name = nom.value.trim().replace(/\s+/g, ' ');
    const mail = email.value.trim();
    const more = details.value.trim();
    const lines = [
      'Bonjour,',
      '',
      choice ? choice.dataset.sentence : 'Je souhaite exercer un droit sur les données personnelles que GJS détient à mon sujet : [droit à préciser].',
    ];
    if (more) lines.push('', 'Précisions :', more);
    lines.push(
      '',
      `Nom : ${name || '[votre nom]'}`,
      `Email utilisé avec GJS : ${mail || '[votre email]'}`,
      '',
      'Merci de me répondre dans le délai d’un mois prévu par l’article 12 du RGPD.',
      '',
      'Cordialement,',
      name || '[votre nom]',
    );
    return { subject: plain(choice ? choice.dataset.subject : 'Exercice de mes droits RGPD'), body: plain(lines.join('\n')) };
  };

  const render = () => {
    const { subject, body } = compose();
    subjectOut.textContent = subject;
    bodyOut.textContent = body;
    preview.hidden = !(checked() || nom.value.trim() || email.value.trim() || details.value.trim());
  };

  const check = () => {
    const errors = [];
    if (!checked()) errors.push({ key: 'droit', msg: MESSAGES.droit });
    if (nom.value.trim().length < 2) errors.push({ key: 'nom', msg: MESSAGES.nom });
    const mail = email.value.trim();
    if (!mail) errors.push({ key: 'email', msg: MESSAGES.emailEmpty });
    else if (!EMAIL_RE.test(mail)) errors.push({ key: 'email', msg: MESSAGES.emailBad });
    return errors;
  };

  const showErrors = (errors) => {
    const byKey = Object.fromEntries(errors.map((e) => [e.key, e.msg]));
    ['droit', 'nom', 'email'].forEach((key) => {
      const msg = byKey[key] || '';
      const out = $(`[data-error-for="${key}"]`, form);
      if (out) out.textContent = msg;
      const inputs = key === 'droit' ? radios : [key === 'nom' ? nom : email];
      inputs.forEach((input) => {
        if (msg) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      });
      if (key === 'droit') group.toggleAttribute('data-invalid', Boolean(msg));
    });
  };

  // Résumé des erreurs (role="alert") : affiché, puis rempli, pour être annoncé
  const showSummary = (errors) => {
    if (!errors.length) {
      summary.hidden = true;
      summary.textContent = '';
      return;
    }
    const title = errors.length > 1 ? `${errors.length} points à corriger :` : 'Un point à corriger :';
    summary.hidden = false;
    summary.textContent = '';
    requestAnimationFrame(() => {
      summary.innerHTML = `<p><strong>${title}</strong></p><ul>${errors.map((e) => `<li><a href="#" data-fix="${e.key}">${e.msg}</a></li>`).join('')}</ul>`;
    });
  };

  const fieldFor = (key) => (key === 'droit' ? (checked() || radios[0]) : (key === 'nom' ? nom : email));

  const focusField = (field) => {
    scrollTo(field.closest('.field, fieldset') || field);
    field.focus({ preventScroll: true });
  };

  summary.addEventListener('click', (e) => {
    const link = e.target.closest('[data-fix]');
    if (!link) return;
    e.preventDefault();
    focusField(fieldFor(link.dataset.fix));
  });

  const revalidate = () => {
    if (!submitted) return;
    const errors = check();
    showErrors(errors);
    // On ne réécrit pas le résumé à chaque frappe (il serait relu) : on le masque une fois tout corrigé
    if (!errors.length) showSummary([]);
  };

  form.addEventListener('input', () => { render(); revalidate(); });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'droit' && hint) hint.textContent = e.target.dataset.hint || defaultHint;
    render();
    revalidate();
  });

  const openMail = (href) => {
    // Lien temporaire : fonctionne partout (mobile compris) sans quitter la page
    const link = document.createElement('a');
    link.href = href;
    link.hidden = true;
    link.dataset.noTransition = '';
    form.appendChild(link);
    link.click();
    link.remove();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitted = true;
    render();
    const errors = check();
    showErrors(errors);
    showSummary(errors);
    if (errors.length) {
      status.textContent = '';
      focusField(fieldFor(errors[0].key));
      return;
    }
    const { subject, body } = compose();
    openMail(`mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`);
    status.textContent = `Votre messagerie s’ouvre avec le message prêt : relisez-le, puis envoyez-le. Rien ne s’est ouvert ? Copiez le message et collez-le dans un email adressé à ${CONFIG.EMAIL}.`;
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      render();
      const { subject, body } = compose();
      const text = `À : ${CONFIG.EMAIL}\nObjet : ${subject}\n\n${body}`;
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch { ok = false; }
      if (!ok) ok = legacyCopy(text, copyBtn);
      if (ok) {
        copyBtn.textContent = 'Message copié';
        status.textContent = `Message copié : collez-le dans un nouvel email adressé à ${CONFIG.EMAIL}.`;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => { copyBtn.textContent = 'Copier le message'; }, 2600);
      } else {
        preview.hidden = false;
        selectContents(bodyOut);
        status.textContent = 'La copie automatique n’a pas fonctionné : le message est sélectionné dans l’aperçu, copiez-le avec Ctrl + C (ou ⌘ + C).';
      }
    });
  }

  // Valeurs restaurées par le navigateur (retour arrière) : aperçu et aide à jour
  const pre = checked();
  if (pre && hint) hint.textContent = pre.dataset.hint || defaultHint;
  render();
}

/* ---- Politique de cookies : ce que ce navigateur a enregistré ------------- */

const GAME_NAMES = { button: 'La meilleure agence ?', race: 'Bad Practices Highway', maze: 'Lead Rush' };
const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Lecture seule : un stockage bloqué lève une erreur dès l'accès
function storageWorks() {
  try { return typeof window.localStorage.length === 'number'; } catch { return false; }
}

/** Choix de cookies valide (mêmes règles que core/cookies.js : version et 182 jours). */
function readConsent() {
  const saved = store.get('gjs-consent');
  if (!saved || saved.v !== CONFIG.CONSENT_VERSION) return null;
  const date = new Date(saved.date);
  const age = (Date.now() - date.getTime()) / DAY;
  if (!Number.isFinite(age) || age > CONFIG.CONSENT_MAX_AGE_DAYS) return null;
  return { ...saved, date };
}

function siteKeys(area) {
  try {
    const s = window[`${area}Storage`];
    return Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k) => k && k.startsWith('gjs-'));
  } catch { return []; }
}

function removeKey(area, key) {
  try { window[`${area}Storage`].removeItem(key); } catch { /* stockage bloqué */ }
}

function consentPanel() {
  const box = $('[data-consent-status]');
  if (!box) return null;
  const dateOut = $('[data-consent-date]', box);
  const LABELS = {
    analytics: { on: 'Acceptée', off: 'Refusée' },
    marketing: { on: 'Accepté', off: 'Refusé' },
  };
  return () => {
    const consent = readConsent();
    Object.keys(LABELS).forEach((cat) => {
      const state = $(`[data-consent-cat="${cat}"] .legal__state`, box);
      if (!state) return;
      const on = Boolean(consent && consent[cat]);
      state.classList.toggle('is-on', on);
      state.textContent = consent ? LABELS[cat][on ? 'on' : 'off'] : 'À choisir';
    });
    if (consent) {
      const until = new Date(consent.date.getTime() + CONFIG.CONSENT_MAX_AGE_DAYS * DAY);
      dateOut.textContent = `Choix enregistré le ${fmtDate.format(consent.date)}, valable jusqu’au ${fmtDate.format(until)}.`;
    } else {
      dateOut.textContent = storageWorks()
        ? 'Aucun choix enregistré sur ce navigateur pour l’instant : le bandeau vous le demandera.'
        : 'Votre navigateur bloque le stockage : votre choix ne peut pas être mémorisé.';
    }
    box.hidden = false;
  };
}

function devicePanel(onClear) {
  const box = $('[data-device]');
  if (!box) return null;
  const list = $('[data-device-list]', box);
  const button = $('[data-device-clear]', box);
  const status = $('[data-device-status]', box);
  let armed = false;
  let timer = 0;

  const entries = () => {
    const out = [];
    const local = siteKeys('local');
    const session = siteKeys('session');
    const records = local.filter((k) => k.startsWith('gjs-arcade-') && k !== 'gjs-arcade-sound');
    if (local.includes('gjs-consent')) {
      const consent = readConsent();
      out.push(['Votre choix de cookies', consent ? `enregistré le ${fmtDate.format(consent.date)} (gjs-consent).` : 'périmé, il sera effacé à votre prochaine visite (gjs-consent).']);
    }
    if (records.length) {
      const detail = records.map((k) => {
        const id = k.slice('gjs-arcade-'.length);
        const best = store.get(k);
        return `${GAME_NAMES[id] || id}${best && best.label ? ` : ${best.label}` : ''}`;
      }).join(' · ');
      out.push([records.length > 1 ? `${records.length} records des mini-jeux` : 'Un record des mini-jeux', detail]);
    }
    if (local.includes('gjs-arcade-sound')) out.push(['Le son de l’arcade', store.get('gjs-arcade-sound') ? 'activé.' : 'coupé.']);
    if (local.includes('gjs-visited')) out.push(['L’écran de chargement', 'déjà vu sur ce navigateur (gjs-visited).']);
    const known = new Set(['gjs-consent', 'gjs-arcade-sound', 'gjs-visited', ...records]);
    const others = local.filter((k) => !known.has(k)).concat(session);
    if (others.length) out.push(['Autres données du site', `${others.join(', ')}.`]);
    return out;
  };

  const render = () => {
    const items = entries();
    list.textContent = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = 'Aucune donnée de ce site n’est enregistrée dans ce navigateur.';
      list.appendChild(li);
    }
    items.forEach(([title, text]) => {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = title;
      li.append(strong, ` : ${text}`);
      list.appendChild(li);
    });
    button.hidden = !items.length;
    box.hidden = false;
  };

  const disarm = () => {
    armed = false;
    button.textContent = 'Effacer ces données';
  };

  button.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      button.textContent = 'Confirmer l’effacement';
      status.textContent = 'Cliquez à nouveau pour confirmer : vos records, votre choix de cookies et vos préférences seront effacés de ce navigateur.';
      clearTimeout(timer);
      timer = setTimeout(() => { disarm(); status.textContent = ''; }, 6000);
      return;
    }
    clearTimeout(timer);
    const consent = readConsent();
    ['local', 'session'].forEach((area) => siteKeys(area).forEach((key) => removeKey(area, key)));
    disarm();
    if (onClear) onClear();
    box.setAttribute('tabindex', '-1');
    box.focus({ preventScroll: true });
    if (CONFIG.ANALYTICS && consent && consent.analytics) {
      // Un outil de mesure déjà chargé ne se décharge pas : on recharge la page
      status.textContent = 'Données effacées. La page se recharge pour désactiver la mesure d’audience.';
      setTimeout(() => window.location.reload(), 1400);
    } else {
      status.textContent = 'C’est fait : les données de ce site sont effacées de ce navigateur. Le bandeau cookies vous redemandera votre choix à votre prochaine visite.';
    }
  });

  return render;
}

function browserPanels() {
  const renders = [];
  const refresh = () => renders.forEach((render) => render());
  [consentPanel(), devicePanel(refresh)].forEach((render) => { if (render) renders.push(render); });
  if (!renders.length) return;
  refresh();
  // Le bandeau (core/cookies.js) enregistre le choix pendant son propre écouteur : on relit juste après
  document.addEventListener('click', (e) => { if (e.target.closest('[data-consent]')) setTimeout(refresh, 0); });
  document.addEventListener('submit', (e) => { if (e.target.id === 'cookies-prefs') setTimeout(refresh, 0); });
  window.addEventListener('storage', refresh);
}

export default function init() {
  rightsForm();
  browserPanels();
}
