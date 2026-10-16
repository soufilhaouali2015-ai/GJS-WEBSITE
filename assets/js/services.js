/* ==========================================================================
   GJS · LES 9 SERVICES : SOURCE UNIQUE (prix, badges, textes)

   ➜ Pour changer un prix, un badge ou un texte : modifiez CE fichier, puis lancez
        npm run services        (ou : node scripts/sync-services.mjs)
     La commande réécrit les cartes, les fiches détaillées, les choix du formulaire
     et les données structurées dans les pages HTML (le contenu reste dans le HTML
     pour le SEO).
   ➜ Filet de sécurité : si vous oubliez la commande, les prix et badges affichés
     sont quand même corrigés au chargement de la page (mais Google verra l'ancien
     texte tant que la commande n'est pas lancée).

   Prix : montants HORS TAXES, en euros.
     setup   = montant unique « à partir de » (0 si aucun)
     monthly = abonnement mensuel « à partir de » (0 si aucun)
     note    = précision affichée sous le prix (facultatif)
   ========================================================================== */

export const SERVICES = [
  {
    id: 'site',
    name: 'Création de site internet',
    label: 'Création de site internet',
    short: 'Site internet',
    tagline: 'Vitrine ou e-commerce, on s’occupe de tout',
    icon: 'site',
    featured: true,
    badge: 'Best-seller',
    benefit: 'Un site qui inspire confiance et transforme vos visiteurs en clients. Vous nous donnez vos idées, on s’occupe du reste.',
    includes: [
      'Design sur-mesure, parfait sur mobile',
      'Textes, photos et référencement de base',
      'Mise en ligne, nom de domaine et hébergement configurés',
    ],
    price: { setup: 800, monthly: 0, note: '' },
    delay: '2 à 4 semaines pour un site vitrine, 4 à 8 semaines pour un e-commerce',
    does: [
      'On définit ensemble vos pages, votre message et vos objectifs.',
      'On crée un design à votre image, adapté au téléphone et à l’ordinateur.',
      'On intègre vos textes et vos photos, ou on les rédige avec vous.',
      'On optimise la vitesse et le référencement de base sur Google.',
      'Pour l’e-commerce : catalogue, paiement en ligne et livraison.',
    ],
    gets: [
      'Un site prêt à l’emploi, à votre nom',
      'Un formulaire de contact relié à votre boîte mail',
      'Une prise en main pour modifier vos contenus seul',
      'Les mentions légales et le bandeau cookies conformes',
    ],
  },
  {
    id: 'app',
    name: 'Application mobile',
    label: 'Application mobile',
    short: 'Appli mobile',
    tagline: 'Sur iPhone et Android',
    icon: 'app',
    featured: true,
    badge: 'Coup de cœur',
    benefit: 'Votre application dans la poche de vos clients. Pour les fidéliser et leur simplifier la vie.',
    includes: [
      'Maquettes et parcours pensés pour vos clients',
      'Application iPhone et Android',
      'Publication sur l’App Store et Google Play',
    ],
    price: { setup: 4000, monthly: 0, note: '' },
    delay: '8 à 12 semaines',
    does: [
      'On garde les fonctionnalités vraiment utiles, sans superflu.',
      'On dessine les écrans et on les teste avec vous.',
      'On développe l’application pour iPhone et Android.',
      'On s’occupe de la publication sur les stores.',
    ],
    gets: [
      'Une application à votre nom sur les deux stores',
      'Un espace pour gérer vos contenus',
      'Un accompagnement pendant le lancement',
    ],
  },
  {
    id: 'acquisition',
    name: 'Acquisition de nouveaux clients',
    label: 'Acquisition de nouveaux clients',
    short: 'Nouveaux clients',
    tagline: 'Prospects, prospection automatisée, growth hacking',
    icon: 'acquisition',
    featured: true,
    badge: 'Le plus demandé',
    benefit: 'Des prospects qualifiés contactés chaque mois, sans passer vos soirées à prospecter.',
    includes: [
      'Base de données de prospects ciblés',
      'Prospection automatisée par email et LinkedIn',
      'Techniques de growth hacking testées chaque mois',
    ],
    price: { setup: 650, monthly: 500, note: '' },
    delay: 'Mise en place en 2 semaines, puis suivi chaque mois',
    does: [
      'On définit votre client idéal : secteur, taille, zone, décideur.',
      'On construit votre base de prospects qualifiés.',
      'On écrit et on automatise vos messages de prospection.',
      'On teste, on mesure et on ajuste chaque mois.',
    ],
    gets: [
      'Un flux régulier de prospects contactés',
      'Un tableau de suivi des contacts et des réponses',
      'Un point mensuel sur les résultats',
    ],
  },
  {
    id: 'social',
    name: 'Réseaux sociaux',
    label: 'Gestion et optimisation des réseaux sociaux',
    short: 'Réseaux sociaux',
    tagline: 'Instagram, Facebook, LinkedIn, TikTok',
    icon: 'social',
    featured: false,
    badge: '',
    benefit: 'Des comptes actifs et soignés qui donnent envie de vous suivre. Sans y passer vos journées.',
    includes: [
      'Calendrier de publications chaque mois',
      'Création des visuels et des textes',
      'Optimisation de vos profils',
    ],
    price: { setup: 0, monthly: 350, note: '' },
    delay: 'Premières publications sous 2 semaines',
    does: [
      'On choisit avec vous les réseaux qui comptent pour votre activité.',
      'On prépare un calendrier de publications.',
      'On crée les visuels, les vidéos courtes et les textes.',
      'On publie et on suit les statistiques.',
    ],
    gets: [
      'Des profils complets et cohérents',
      'Des publications régulières, à votre image',
      'Un bilan simple chaque mois',
    ],
  },
  {
    id: 'automatisation',
    name: 'Automatisations IA',
    label: 'Automatisations IA',
    short: 'Automatisations IA',
    tagline: 'Les tâches répétitives en pilote automatique',
    icon: 'automatisation',
    featured: false,
    badge: '',
    benefit: 'Les tâches répétitives se font toutes seules. Vous récupérez des heures chaque semaine.',
    includes: [
      'Repérage des tâches qui vous font perdre du temps',
      'Connexion de vos outils entre eux',
      'IA pour trier, rédiger et relancer',
    ],
    price: { setup: 500, monthly: 0, note: '' },
    delay: '1 à 3 semaines',
    does: [
      'On repère avec vous les tâches qui vous font perdre du temps.',
      'On connecte vos outils : mails, agenda, factures, tableurs.',
      'On ajoute l’IA là où elle aide vraiment : tri, rédaction, résumés.',
      'On teste, on documente et on vous forme.',
    ],
    gets: [
      'Des automatisations qui tournent seules',
      'Une documentation simple',
      'Une alerte si quelque chose bloque',
    ],
  },
  {
    id: 'agent-ia',
    name: 'Agent IA',
    label: 'Agent IA',
    short: 'Agent IA',
    tagline: 'Il répond à vos clients 24h/24',
    icon: 'agent',
    featured: false,
    badge: '',
    benefit: 'Un assistant qui répond à vos clients jour et nuit et prend les rendez-vous à votre place.',
    includes: [
      'Réponses à vos clients 24h/24',
      'Prise de rendez-vous dans votre agenda',
      'Ton et informations adaptés à votre activité',
    ],
    price: { setup: 1000, monthly: 100, note: '' },
    delay: '2 à 4 semaines',
    does: [
      'On rassemble vos infos : services, prix, horaires, questions fréquentes.',
      'On configure l’agent avec votre ton.',
      'On le connecte à votre site et à votre agenda.',
      'On suit les conversations et on l’améliore.',
    ],
    gets: [
      'Un agent installé sur votre site',
      'Les demandes et rendez-vous transmis directement',
      'Un suivi et des ajustements chaque mois',
    ],
  },
  {
    id: 'seo',
    name: 'SEO',
    label: 'SEO (référencement naturel)',
    short: 'SEO',
    tagline: 'Être trouvé sur Google, sans payer chaque clic',
    icon: 'seo',
    featured: false,
    badge: '',
    benefit: 'Remonter sur Google quand vos clients vous cherchent. Des visites qui arrivent toutes seules, mois après mois.',
    includes: [
      'Audit de votre site et de vos mots-clés',
      'Optimisations techniques et contenus',
      'Suivi de vos positions chaque mois',
    ],
    price: { setup: 0, monthly: 200, note: '' },
    delay: 'Premiers effets en 3 à 6 mois',
    does: [
      'On identifie ce que vos futurs clients tapent sur Google.',
      'On corrige ce qui freine votre site.',
      'On optimise vos pages et on rédige des contenus utiles.',
      'On soigne votre fiche Google Business Profile.',
    ],
    gets: [
      'Un plan d’action clair',
      'Des pages et des contenus optimisés',
      'Un rapport de positions chaque mois',
    ],
  },
  {
    id: 'sea',
    name: 'SEA',
    label: 'SEA (Google Ads, Meta Ads)',
    short: 'SEA',
    tagline: 'Publicité payante sur Google et les réseaux',
    icon: 'sea',
    featured: false,
    badge: '',
    benefit: 'Des publicités qui s’affichent devant les bons clients, au bon moment.',
    includes: [
      'Création et réglage des campagnes',
      'Annonces et visuels',
      'Suivi et optimisation chaque mois',
    ],
    price: { setup: 0, monthly: 150, note: 'Budget publicitaire en plus' },
    delay: 'Campagnes en ligne sous 7 jours',
    does: [
      'On définit vos cibles et votre budget.',
      'On crée vos campagnes Google Ads et Meta Ads (Facebook, Instagram).',
      'On rédige les annonces et on prépare les visuels.',
      'On optimise chaque mois pour réduire le coût par client.',
    ],
    gets: [
      'Des campagnes en ligne, sur vos propres comptes',
      'Un suivi des demandes générées',
      'Un rapport clair chaque mois',
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    label: 'CRM (suivi clients)',
    short: 'CRM',
    tagline: 'Installation et automatisation du suivi clients',
    icon: 'crm',
    featured: false,
    badge: '',
    benefit: 'Tous vos clients et prospects au même endroit, avec des relances qui partent toutes seules.',
    includes: [
      'Choix et installation du bon outil',
      'Import de vos contacts',
      'Relances et suivi automatisés',
    ],
    price: { setup: 800, monthly: 0, note: '' },
    delay: '2 à 4 semaines',
    does: [
      'On choisit avec vous l’outil adapté (HubSpot, Pipedrive, Brevo…).',
      'On importe vos contacts et on organise vos étapes de vente.',
      'On automatise les relances, les rappels et les tâches.',
      'On forme votre équipe.',
    ],
    gets: [
      'Un CRM prêt à l’emploi',
      'Des relances automatiques',
      'Une formation à la prise en main',
    ],
  },
];

/** Phrase affichée sous chaque grille de prix. */
export const PRICE_NOTE = 'Prix hors taxes. Chaque projet est chiffré précisément après un premier échange gratuit.';

/* ---- Mise en forme (partagée entre le navigateur et le script de synchro) ---- */

const NBSP = ' ';

/** 4000 → « 4 000 € » (espaces insécables). */
export function formatEuros(amount) {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${NBSP}€`;
}

/** Prix de départ : « 800 € », « 350 €/mois » ou « 650 € + 500 €/mois ». */
export function formatPrice(service) {
  const { setup, monthly } = service.price;
  const parts = [];
  if (setup) parts.push(formatEuros(setup));
  if (monthly) parts.push(`${formatEuros(monthly)}/mois`);
  return parts.join(`${NBSP}+ `);
}

export const getService = (id) => SERVICES.find((s) => s.id === id);
