/**
 * InfoPanelAnimations - GSAP animations for the building info panel
 * Provides elegant slide-in and slide-out animations
 */

import { gsap } from 'gsap';

class InfoPanelAnimations {
  constructor() {
    this.overlay = null;
    this.header = null;
    this.body = null;
    this.isAnimating = false;
    this.timeline = null;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.overlay = document.querySelector('.info-building-overlay');
    
    if (!this.overlay) {
      console.warn('Info panel overlay not found');
      return;
    }

    this.header = this.overlay.querySelector('.info-building__header');
    this.body = this.overlay.querySelector('.info-building__body');

    // Set initial state
    this.setInitialState();
    
    // Observe class changes to trigger animations
    this.observeClassChanges();
  }

  setInitialState() {
    // Set initial hidden state with GSAP
    // Panel slides in from right, so we start with positive x (off-screen right)
    gsap.set(this.overlay, {
      opacity: 0,
      x: 440, // Slide from right (slightly more than panel width for smooth entry)
      scale: 0.92,
      visibility: 'hidden',
      pointerEvents: 'none'
    });

    // Hide header and body content initially
    if (this.header) {
      gsap.set(this.header, {
        opacity: 0,
        y: -20,
        scale: 0.95
      });
    }

    if (this.body) {
      gsap.set(this.body, {
        opacity: 0,
        y: 20
      });
    }
  }

  observeClassChanges() {
    // Use MutationObserver to watch for 'active' class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isActive = this.overlay.classList.contains('active');
          
          if (isActive && !this.isAnimating) {
            this.animateIn();
          } else if (!isActive && !this.isAnimating) {
            this.animateOut();
          }
        }
      });
    });

    observer.observe(this.overlay, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  animateIn() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // Kill any existing animations
    if (this.timeline) {
      this.timeline.kill();
    }

    // Create new timeline
    this.timeline = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
      }
    });

    // Ensure z-index is set before animating
    gsap.set(this.overlay, {
      zIndex: 10020,
      visibility: 'visible',
      pointerEvents: 'auto'
    });

    // Main panel animation - slide in from right with scale and subtle bounce
    this.timeline.to(this.overlay, {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.55,
      ease: 'power3.out'
    });

    // Header animation - fade and slide down
    if (this.header) {
      this.timeline.to(this.header, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: 'power2.out'
      }, '-=0.3'); // Start slightly before panel finishes
    }

    // Body content animation - fade and slide up with stagger for children
    if (this.body) {
      const bodyChildren = this.body.children;
      this.timeline.to(this.body, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, '-=0.25');
      
      // Animate children with stagger for a nice cascading effect
      if (bodyChildren.length > 0) {
        gsap.set(bodyChildren, { opacity: 0, y: 10 });
        this.timeline.to(bodyChildren, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.05,
          ease: 'power2.out'
        }, '-=0.2');
      }
    }
  }

  animateOut() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // Kill any existing animations
    if (this.timeline) {
      this.timeline.kill();
    }

    // Create new timeline
    this.timeline = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        // Reset to hidden state
        gsap.set(this.overlay, {
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -1
        });
        this.setInitialState();
      }
    });

    // Fade out header and body content first
    if (this.header) {
      this.timeline.to(this.header, {
        opacity: 0,
        y: -10,
        scale: 0.95,
        duration: 0.2,
        ease: 'power2.in'
      });
    }

    if (this.body) {
      this.timeline.to(this.body, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        ease: 'power2.in'
      }, '-=0.2'); // Simultaneous with header
    }

    // Main panel animation - slide out to right with scale
    this.timeline.to(this.overlay, {
      opacity: 0,
      x: 440,
      scale: 0.92,
      duration: 0.4,
      ease: 'power3.in'
    }, '-=0.1');
  }
}

// Export singleton instance
const infoPanelAnimations = new InfoPanelAnimations();
export default infoPanelAnimations;

