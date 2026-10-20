import { initPWA } from '../../../pwa.js';
import { mountSiteLegalFooter } from './mountSiteLegalFooter.js';
import { mountCookieConsent } from './mountCookieBanner.js';

/**
 * Bootstrap commun des pages site (hors /game) :
 * footer légal, module cookies, service worker (autoUpdate + toast).
 *
 * `beforeCookies` : promesse que le bandeau cookies attend avant de se monter (un message d'arrivée ne se
 * superpose pas au bandeau).
 *
 * @param {{ cookieAutoOpen?: boolean, legalFooter?: boolean, beforeCookies?: Promise<void> }} [options]
 */
export function bootSiteChrome({ cookieAutoOpen = false, legalFooter = true, beforeCookies = Promise.resolve() } = {}) {
  if (legalFooter) {
    mountSiteLegalFooter();
  }
  beforeCookies.then(() => mountCookieConsent({ autoOpen: cookieAutoOpen }));
  initPWA();
}
