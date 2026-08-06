import { hasRecordedConsent } from './cookieConsent.js';

const JQUERY_URL = 'https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js';
const STYLE_HREF = '/cookiebanner/cookiebanner.style.css';
const PANELS_STYLE_HREF = '/cookiebanner/cookiebanner.panels.css';
const FAB_STYLE_HREF = '/src/presentation/pages/site/cookie-consent-fab.css';
const SCRIPT_SRC = '/cookiebanner/cookiebanner.script.js';
const FAB_ID = 'cookieConsentFab';

let assetsPromise = null;

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadCookieAssets() {
  if (!assetsPromise) {
    loadStylesheet(STYLE_HREF);
    loadStylesheet(PANELS_STYLE_HREF);
    loadStylesheet(FAB_STYLE_HREF);
    assetsPromise = loadScript(JQUERY_URL).then(() => loadScript(SCRIPT_SRC));
  }
  return assetsPromise;
}

function setFabVisible(visible) {
  const fab = document.getElementById(FAB_ID);
  if (fab) {
    fab.hidden = !visible;
  }
}

function mountCookieFab() {
  if (document.getElementById(FAB_ID)) {
    return;
  }

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = FAB_ID;
  fab.className = 'cookie-consent-fab';
  fab.setAttribute('aria-label', 'Gérer les cookies');
  fab.title = 'Gérer les cookies';
  fab.textContent = '🍪';

  fab.addEventListener('click', () => {
    if (window.cookieBanner?.open) {
      window.cookieBanner.open();
    }
  });

  document.body.appendChild(fab);
}

let fabVisibilityBound = false;

function bindFabVisibility() {
  if (fabVisibilityBound) return;
  fabVisibilityBound = true;
  document.addEventListener('cookie-banner:opened', () => setFabVisible(false));
  document.addEventListener('cookie-banner:closed', () => setFabVisible(true));
}

/**
 * Bandeau cookies + bouton de réouverture (🍪, bas droite).
 * @param {{ autoOpen?: boolean }} options
 *   - autoOpen: true uniquement sur l'accueil — ouvre le bandeau si aucun consentement enregistré.
 */
export async function mountCookieConsent({ autoOpen = false } = {}) {
  try {
    await loadCookieAssets();
    mountCookieFab();
    bindFabVisibility();

    const consentRecorded = hasRecordedConsent();
    setFabVisible(consentRecorded || !autoOpen);

    if (window.cookieBanner?.init) {
      window.cookieBanner.init({ autoOpen });
    }
  } catch (error) {
    console.warn('[CookieConsent] Chargement impossible:', error);
  }
}

/** @deprecated Utiliser mountCookieConsent */
export async function mountCookieBanner() {
  return mountCookieConsent({ autoOpen: true });
}
