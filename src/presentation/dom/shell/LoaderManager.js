/**
 * Discrete game loader — small spinner overlay, no full-screen chrome.
 */

class LoaderManager {
  constructor() {
    this.el = document.getElementById('game-loader');
    this.isVisible = false;
  }

  show() {
    if (!this.el) {
      console.warn('Game loader not found');
      return;
    }
    this.el.classList.remove('hidden');
    this.el.setAttribute('aria-busy', 'true');
    this.isVisible = true;
  }

  /**
   * @param {number} delay - ms before hiding (fade-out still runs)
   */
  hide(delay = 0) {
    if (!this.el) return;

    const applyHide = () => {
      this.el.classList.add('hidden');
      this.el.setAttribute('aria-busy', 'false');
      this.isVisible = false;
    };

    if (delay > 0) {
      setTimeout(applyHide, delay);
    } else {
      applyHide();
    }
  }

  isShowing() {
    return this.isVisible;
  }
}

const loaderManager = new LoaderManager();

export default loaderManager;
