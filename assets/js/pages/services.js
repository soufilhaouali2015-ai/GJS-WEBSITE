/* ==========================================================================
   GJS · PAGE SERVICES
   Fiches des 9 services : chaque fiche (inclus, ce qu'on fait, livrables,
   délai) est une <dialog> qui s'ouvre depuis l'index typographique, une carte
   du carrousel ou un lien services.html#site venu d'une autre page.
   L'adresse suit la fiche ouverte (#site) : le bouton retour du téléphone la
   referme. Échap, le bouton × ou un clic à côté la ferment aussi, et le focus
   revient sur le lien d'origine. « Je veux ça » coche le service dans le
   formulaire de demande et y descend.
   Formulaire de demande : mêmes règles, même anti-spam, même envoi et même
   écran de succès que la page Contact (core/forms.js).
   Sans JS : chaque fiche s'affiche à son ancre (:target, voir services.css).
   ========================================================================== */

import { $, $$, announce } from '../core/utils.js';
import { isReduced } from '../core/profile.js';
import { getLenis, scrollTo } from '../core/scroll.js';
import { validate, showError, renderSummary, bindSummary, submitRequest, liveValidation, refreshOnResize } from '../core/forms.js';

const { gsap } = window;
const root = document.documentElement;
const WIDE = window.matchMedia('(min-width: 720px)'); // fiche centrée (sinon : panneau qui monte du bas)

function initSheets() {
  const sheets = $$('[data-sheet]');
  if (!sheets.length) return;
  const byId = new Map(sheets.map((d) => [d.id, d]));
  const motion = Boolean(gsap) && !isReduced;
  let current = null;
  let opener = null;
  let pushed = false; // la fiche a ajouté une entrée dans l'historique
  let skipFocus = false;
  let afterClose = null; // action à lancer une fois la fiche refermée (« Je veux ça »)
  let afterPop = null;

  root.classList.add('has-sheets');

  const idFromHash = (hash) => decodeURIComponent((hash || '').slice(1));

  const open = (dialog, { from = null, push = false } = {}) => {
    if (current === dialog) return;
    if (current) current.close();
    current = dialog;
    // Sans lien d'origine (arrivée par l'adresse), le focus reviendra sur la ligne de l'index
    opener = from || $(`.svc-index__link[href="#${CSS.escape(dialog.id)}"]`);
    if (push) {
      history.pushState({ sheet: dialog.id }, '', `#${dialog.id}`);
      pushed = true;
    }
    dialog.showModal();
    dialog.scrollTop = 0;
    $('[data-sheet-close]', dialog).focus({ preventScroll: true });
    root.classList.add('is-sheet-open');
    getLenis()?.stop();
    announce(`Fiche ${dialog.querySelector('.svc-sheet__title').textContent} ouverte.`);
    if (!motion) return;
    const card = $('.svc-sheet__card', dialog);
    const wide = WIDE.matches;
    const parts = $$('.svc-sheet__kicker, .svc-sheet__title, .svc-sheet__tagline, .svc-sheet__body > .t-intro, .svc-sheet__cols > *, .svc-sheet__foot', dialog);
    gsap.killTweensOf([dialog, card, ...parts]);
    gsap.timeline()
      .fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      // Mobile : la fiche monte du bas de l'écran ; ordinateur : elle se pose en se redressant
      .fromTo(card, wide ? { y: 80, rotation: -2, opacity: 0 } : { yPercent: 100 }, {
        y: 0, yPercent: 0, rotation: 0, opacity: 1, duration: wide ? 0.8 : 0.6, ease: 'expo.out', clearProps: 'transform,opacity',
      }, 0)
      .from(parts, { y: 24, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.12);
  };

  // Fermeture animée ; le rangement se fait à l'événement « close » (aussi déclenché par Échap)
  const close = (dialog = current, { restoreFocus = true, then = null } = {}) => {
    if (!dialog || !dialog.open) return;
    skipFocus = !restoreFocus;
    afterClose = then;
    if (!motion) { dialog.close(); return; }
    const card = $('.svc-sheet__card', dialog);
    gsap.killTweensOf([dialog, card]);
    gsap.timeline({ onComplete: () => { dialog.close(); gsap.set([dialog, card], { clearProps: 'all' }); } })
      .to(card, WIDE.matches ? { y: 60, opacity: 0, duration: 0.3, ease: 'power2.in' } : { yPercent: 100, duration: 0.35, ease: 'power2.in' })
      .to(dialog, { opacity: 0, duration: 0.25, ease: 'power2.in' }, '-=0.2');
  };

  sheets.forEach((dialog) => {
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(dialog); });
    dialog.addEventListener('close', () => {
      if (current !== dialog) return;
      current = null;
      root.classList.remove('is-sheet-open');
      getLenis()?.start();
      if (!skipFocus && opener && opener.isConnected) opener.focus({ preventScroll: true });
      skipFocus = false;
      opener = null;
      const next = afterClose;
      afterClose = null;
      // L'adresse revient à la page sans fiche. Après un retour dans l'historique,
      // le navigateur recale la position : la suite attend ce retour.
      if (pushed) {
        pushed = false;
        if (next) {
          afterPop = next;
          setTimeout(() => { if (afterPop === next) { afterPop = null; next(); } }, 400);
        }
        history.back();
        return;
      }
      if (idFromHash(window.location.hash) === dialog.id) {
        history.replaceState(history.state, '', window.location.pathname + window.location.search);
      }
      if (next) requestAnimationFrame(next);
    });
    // Clic à côté de la fiche (sur le voile) : on ferme
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(dialog); });
    $$('[data-sheet-close]', dialog).forEach((btn) => btn.addEventListener('click', () => close(dialog)));
  });

  // « Je veux ça » : le service est coché dans le formulaire de demande,
  // la fiche se referme et la page descend jusqu'au formulaire
  const pickService = (pick) => {
    const form = $('[data-quick-form]');
    const box = form && form.querySelector(`input[name="besoins"][value="${CSS.escape(pick.dataset.pick)}"]`);
    if (!box) return false;
    if (!box.checked) {
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const dialog = pick.closest('dialog');
    const name = dialog ? dialog.querySelector('.svc-sheet__title').textContent : '';
    const goToForm = () => {
      scrollTo($('#formulaire-services'));
      const first = $$('input[name="nom"], input[name="email"]', form).find((i) => !i.value.trim()) || box;
      first.focus({ preventScroll: true });
      announce(`${name} est coché dans votre demande de devis.`);
    };
    if (dialog && dialog.open) close(dialog, { restoreFocus: false, then: goToForm });
    else goToForm();
    return true;
  };

  // Liens vers une fiche (index, carrousel) : ouverture au lieu du saut d'ancre.
  // Écouté sur <main> pour passer avant les transitions de page (document).
  $('main').addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      if (pickService(pick)) e.preventDefault();
      return;
    }
    const a = e.target.closest('a[href^="#"]');
    const dialog = a && byId.get(idFromHash(a.getAttribute('href')));
    if (!dialog) return;
    e.preventDefault();
    open(dialog, { from: a, push: true });
  });

  // Retour / avance du navigateur : la fiche suit l'adresse
  window.addEventListener('popstate', () => {
    if (afterPop) {
      const next = afterPop;
      afterPop = null;
      requestAnimationFrame(next);
      return;
    }
    const target = byId.get(idFromHash(window.location.hash));
    if (target) open(target, { push: false });
    else if (current) { pushed = false; close(current); }
  });

  // Arrivée sur services.html#site : la fiche s'ouvre directement
  // (la page reste en haut : le navigateur a pu viser l'emplacement de la fiche)
  const initial = byId.get(idFromHash(window.location.hash));
  if (initial) {
    window.scrollTo(0, 0);
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    open(initial);
  }
}

function initQuickForm() {
  const form = $('[data-quick-form]');
  if (!form) return;
  const success = $('[data-quick-success]');
  const errors = $('[data-form-errors]', form);
  const submit = $('[data-form-submit]', form);
  const submitLabel = $('[data-submit-label]', submit);
  const counter = $('[data-char-count]', form);
  const touched = new Set();
  const FIELDS = ['nom', 'email', 'telephone', 'besoins', 'message', 'consentement'];

  // Le JS prend la main (sans JS, le formulaire part en mailto)
  form.noValidate = true;
  form.removeAttribute('action');
  form.removeAttribute('enctype');

  liveValidation(form, touched, counter);
  bindSummary(form, errors);
  refreshOnResize(form.closest('.form-card'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = [];
    FIELDS.forEach((name) => {
      const msg = validate(form, name);
      showError(form, name, msg);
      touched.add(name);
      if (msg) invalid.push({ name, msg });
    });
    renderSummary(errors, invalid);
    if (invalid.length) {
      announce(invalid[0].msg, 'assertive');
      const target = form.querySelector(`[name="${invalid[0].name}"]`);
      if (target) target.focus();
      return;
    }
    await submitRequest({ form, success, errors, submit, submitLabel });
  });
}

export default function init() {
  initSheets();
  initQuickForm();
}
