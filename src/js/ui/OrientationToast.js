/**
 * OrientationToast - Displays a toast message when mobile is in portrait mode
 * Shows "Mode paysage requis - Tournez votre téléphone pour jouer"
 */

class OrientationToast {
  constructor() {
    this.toast = document.getElementById('orientation-toast');
    this.isVisible = false;
    
    if (!this.toast) {
      console.warn('Orientation toast element not found');
      return;
    }
    
    this.init();
  }

  init() {
    // Check initial orientation
    this.checkOrientation();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure orientation has changed
      setTimeout(() => this.checkOrientation(), 100);
    });
    
    // Also listen for resize events (for devices that support it)
    window.addEventListener('resize', () => {
      this.checkOrientation();
    });
  }

  checkOrientation() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTablet = window.matchMedia('(max-width: 1024px) and (min-width: 769px)').matches;
    const isPortrait = window.innerHeight > window.innerWidth;
    
    // Show toast only on mobile/tablet in portrait mode
    if ((isMobile || isTablet) && isPortrait) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    if (!this.toast || this.isVisible) return;
    
    this.toast.classList.add('show');
    this.isVisible = true;
  }

  hide() {
    if (!this.toast || !this.isVisible) return;
    
    this.toast.classList.remove('show');
    this.isVisible = false;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OrientationToast();
  });
} else {
  new OrientationToast();
}

export default OrientationToast;

