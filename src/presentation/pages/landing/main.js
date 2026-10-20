import { setBootMode } from '../site/bootSession.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';
import { ABOUT_PARAM } from '../site/siteLegalLinks.js';

const WELCOME_SEEN_KEY = 'anoria.welcomeNoticeSeen';

/**
 * Message d'arrivée, une seule fois par navigateur, ou à la demande (lien « À propos » du pied de page).
 * Résolu à sa fermeture (tout de suite s'il a déjà été vu et qu'on ne le demande pas).
 * Si le stockage est inaccessible (navigation privée…), on ne peut pas savoir : il s'affiche à chaque visite.
 * @returns {Promise<void>}
 */
function showWelcomeNoticeOnce() {
  const dialog = document.getElementById('site-welcome');
  if (!dialog) {
    throw new Error('[landing] #site-welcome is missing from index.html');
  }

  const requested = new URLSearchParams(window.location.search).has(ABOUT_PARAM);
  let seen = false;
  try {
    seen = localStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    seen = false;
  }
  if (seen && !requested) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      try {
        localStorage.setItem(WELCOME_SEEN_KEY, '1');
      } catch (error) {
        console.warn('[landing] welcome notice flag not stored:', error);
      }
      if (requested) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      resolve();
    }, { once: true });
    document.getElementById('site-welcome-close')?.addEventListener('click', () => dialog.close());
    dialog.showModal();
  });
}

bootSiteChrome({ cookieAutoOpen: true, beforeCookies: showWelcomeNoticeOnce() });

document.querySelectorAll('[data-boot-mode]').forEach((el) => {
  el.addEventListener('click', () => {
    const mode = el.dataset.bootMode;
    if (mode) {
      setBootMode(mode);
    }
  });
});

document.querySelectorAll('.site-btn--beta').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
  });
});
