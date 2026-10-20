/* ==========================================================================
   GJS · CONFIGURATION CENTRALE
   Tout ce qui se personnalise (hors services : voir services.js) est ici.
   Les éléments [data-config="…"] des pages sont synchronisés au chargement.
   Pensez aussi à rechercher/remplacer ces valeurs dans les fichiers HTML : le
   contenu doit rester présent sans JavaScript pour le SEO (voir README).
   ========================================================================== */

export const CONFIG = Object.freeze({
  /** Domaine de production (sans slash final). */
  SITE_URL: 'https://www.gjs-agence.fr',

  /** Coordonnées affichées partout. [À REMPLACER] */
  EMAIL: 'bonjour@gjs-agence.fr',
  PHONE: '01 00 00 00 00',
  PHONE_HREF: '+33100000000',

  /**
   * WhatsApp : numéro au format international, chiffres uniquement, sans « + » ni 0 initial.
   * Exemple pour 06 12 34 56 78 : '33612345678'. [À REMPLACER]
   */
  WHATSAPP: '33600000000',
  WHATSAPP_MESSAGE: 'Bonjour GJS, je voudrais parler de mon projet.',

  /** Lien de prise de rendez-vous (Calendly, Cal.com, Google Agenda…). [À REMPLACER] */
  BOOKING_URL: 'https://cal.com/',

  /**
   * ▶ ENDPOINT DU FORMULAIRE DE CONTACT (POST JSON). Voir le README, section 1.
   * Formspree : 'https://formspree.io/f/xxxxxxxx'
   * Make      : 'https://hook.eu2.make.com/xxxxxxxxxxxxxxxx'
   * Laissé vide : le formulaire ouvre la messagerie du visiteur avec la demande pré-remplie.
   */
  FORM_ENDPOINT: '',

  /** Réseaux sociaux : supprimez une ligne pour masquer le lien partout. [À REMPLACER] */
  SOCIALS: [
    { label: 'Instagram', url: 'https://www.instagram.com/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
  ],

  /**
   * Mesure d'audience : chargée UNIQUEMENT après consentement (catégorie « analytics »).
   * Exemple : { src: 'https://plausible.io/js/script.js', attrs: { 'data-domain': 'gjs-agence.fr' } }
   */
  ANALYTICS: null,

  /** Version du consentement : incrémentez-la si vous ajoutez un traceur (le choix est redemandé). */
  CONSENT_VERSION: 1,
  /** Durée de validité du choix cookies (CNIL : 6 mois). */
  CONSENT_MAX_AGE_DAYS: 182,
});

/** Lien WhatsApp avec message pré-rempli. */
export const whatsappUrl = (message = CONFIG.WHATSAPP_MESSAGE) =>
  `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(message)}`;
