/* ==========================================================================
   GJS · SYNCHRONISATION AVEC LA CONFIG ET LES DONNÉES SERVICES
   Coordonnées, WhatsApp, rendez-vous, réseaux (config.js) et filet de sécurité
   pour les badges (services.js). Le HTML contient déjà les bonnes
   valeurs : ceci ne fait que corriger un oubli de `npm run services`.
   ========================================================================== */

import { CONFIG, whatsappUrl } from '../config.js';
import { $$ } from './utils.js';

export function hydrateConfig(root = document) {
  $$('[data-config="email"]', root).forEach((el) => {
    if (el.tagName === 'A') el.href = `mailto:${CONFIG.EMAIL}`;
    if (!el.hasAttribute('data-keep-text')) el.textContent = CONFIG.EMAIL;
  });
  $$('[data-config="phone"]', root).forEach((el) => {
    if (el.tagName === 'A') el.href = `tel:${CONFIG.PHONE_HREF}`;
    if (!el.hasAttribute('data-keep-text')) el.textContent = CONFIG.PHONE;
  });
  $$('[data-config="whatsapp"]', root).forEach((el) => { el.href = whatsappUrl(); });
  $$('[data-config="booking"]', root).forEach((el) => { el.href = CONFIG.BOOKING_URL; });
  $$('[data-social]', root).forEach((el) => {
    const social = CONFIG.SOCIALS.find((s) => s.label === el.dataset.social);
    const item = el.closest('li') || el;
    if (!social) { item.hidden = true; return; }
    el.href = social.url;
  });
  $$('[data-year]', root).forEach((el) => { el.textContent = String(new Date().getFullYear()); });
}

export async function hydrateServices(root = document) {
  const badges = $$('[data-badge]', root);
  if (!badges.length) return;
  const { getService } = await import('../services.js');
  badges.forEach((el) => {
    const s = getService(el.dataset.badge);
    if (s && s.badge && el.textContent !== s.badge) el.textContent = s.badge;
  });
}
