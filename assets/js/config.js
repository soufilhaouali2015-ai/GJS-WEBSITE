/* ==========================================================================
   GJS — CONFIG CENTRALE
   Tout ce qui se personnalise se trouve ici. Voir le README pour le détail.
   Pensez aussi à rechercher/remplacer l'email et le domaine dans les fichiers
   HTML (le contenu doit rester présent sans JavaScript pour le SEO).
   ========================================================================== */

export const CONFIG = Object.freeze({
  /** Domaine de production (sans slash final) — sert aux liens partagés. */
  SITE_URL: 'https://www.gjs-agence.fr',

  /** Coordonnées affichées partout (les éléments [data-config] sont synchronisés). */
  EMAIL: 'bonjour@gjs-agence.fr',
  PHONE: '+33 1 00 00 00 00',
  PHONE_HREF: '+33100000000',
  ADDRESS: 'Paris & région parisienne',
  LOCATION: { city: 'Paris, FR', lat: '48.8566° N', lng: '2.3522° E', timeZone: 'Europe/Paris' },

  /**
   * Endpoint du formulaire de contact (POST JSON).
   * Compatible Formspree (https://formspree.io/f/xxxx), Make (webhook), n8n (webhook), etc.
   * Laissé vide : le formulaire ouvre le client mail du visiteur avec le message pré-rempli.
   */
  FORM_ENDPOINT: '',

  /** Lien de prise de rendez-vous (Calendly, Cal.com, Google Agenda…). */
  BOOKING_URL: 'https://cal.com/',

  /** Réseaux sociaux — supprimez une ligne pour masquer le lien correspondant. */
  SOCIALS: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
    { label: 'Instagram', url: 'https://www.instagram.com/' },
    { label: 'TikTok', url: 'https://www.tiktok.com/' },
  ],

  /** Code promo débloqué par le mode Hyperespace (code Konami). */
  PROMO_CODE: 'HYPERGJS',

  /** Disponibilité affichée dans le hero. */
  AVAILABILITY: 'Disponible pour nouveaux projets',

  /** Loader : durées en secondes. */
  LOADER: { min: 2.5, max: 4, short: 1 },

  /**
   * Mesure d'audience — chargée UNIQUEMENT après consentement (catégorie "analytics").
   * Exemple Plausible : { src: 'https://plausible.io/js/script.js', attrs: { 'data-domain': 'gjs-agence.fr' } }
   * Laisser à null pour ne rien charger.
   */
  ANALYTICS: null,

  /** Version du consentement : incrémentez-la si vous ajoutez un traceur (redemande le choix). */
  CONSENT_VERSION: 1,
  /** Durée de validité du choix cookies (CNIL : 6 mois recommandés). */
  CONSENT_MAX_AGE_DAYS: 182,
});
