/* ==========================================================================
   GJS — SYNCHRONISATION DU <HEAD> ENTRE PAGES (Barba)
   Titre, meta description, canonical, Open Graph / Twitter, JSON-LD et
   feuilles de style propres à chaque page. Les robots lisent le HTML complet
   de chaque page ; ceci garde le document cohérent pendant la navigation SPA.
   ========================================================================== */

const META_SELECTORS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:image"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
];

function loadStyle(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.pageStyle = '';
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/** Met à jour le head à partir du HTML de la page suivante. Résout quand les CSS sont prêtes. */
export async function syncHead(html) {
  if (!html) return;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (doc.title) document.title = doc.title;

  META_SELECTORS.forEach((sel) => {
    const next = doc.head.querySelector(sel);
    const current = document.head.querySelector(sel);
    if (next && current) {
      ['content', 'href'].forEach((attr) => {
        if (next.hasAttribute(attr)) current.setAttribute(attr, next.getAttribute(attr));
      });
    } else if (next && !current) {
      document.head.appendChild(next.cloneNode(true));
    } else if (!next && current) {
      current.remove();
    }
  });

  // Données structurées
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
  doc.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = s.textContent;
    document.head.appendChild(script);
  });

  // CSS de page : on charge celles qui manquent avant d'afficher la page
  const present = new Set(Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href));
  const missing = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"][data-page-style]'))
    .map((l) => new URL(l.getAttribute('href'), document.baseURI).href)
    .filter((href) => !present.has(href));
  await Promise.all(missing.map(loadStyle));
}
