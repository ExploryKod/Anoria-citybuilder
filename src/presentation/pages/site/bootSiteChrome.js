import { initPWA } from '../../../pwa.js';
import { mountSiteLegalFooter } from './mountSiteLegalFooter.js';
import { mountCookieConsent } from './mountCookieBanner.js';

/**
 * Bootstrap commun des pages site (hors /game) :
 * footer légal, module cookies, service worker (autoUpdate + toast).
 *
 * @param {{ cookieAutoOpen?: boolean }} [options]
 */
export function bootSiteChrome({ cookieAutoOpen = false } = {}) {
  mountSiteLegalFooter();
  mountCookieConsent({ autoOpen: cookieAutoOpen });
  initPWA();
}
