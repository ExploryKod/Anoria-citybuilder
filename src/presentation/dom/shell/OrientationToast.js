/**
 * OrientationToast — mode portrait mobile/tablette (via js-toast-notifier).
 */

import { showWarningToast } from './ToastNotifier.js';

class OrientationToast {
  constructor() {
    /** @type {boolean} */
    this.wasPortrait = false;
    this.init();
  }

  init() {
    this.checkOrientation();

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.checkOrientation(), 100);
    });

    window.addEventListener('resize', () => {
      this.checkOrientation();
    });
  }

  checkOrientation() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTablet = window.matchMedia('(max-width: 1024px) and (min-width: 769px)').matches;
    const isPortrait = window.innerHeight > window.innerWidth;
    const shouldWarn = (isMobile || isTablet) && isPortrait;

    // Une seule annonce à l'entrée en portrait (évite le spam au resize).
    if (shouldWarn && !this.wasPortrait) {
      showWarningToast(
        'Mode paysage requis — Tournez votre téléphone pour jouer',
        { timeout: 3500 }
      );
    }

    this.wasPortrait = shouldWarn;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OrientationToast();
  });
} else {
  new OrientationToast();
}

export default OrientationToast;
