/**
 * ModalAnimations - GSAP animations for centered modals
 * Provides elegant fade-in/scale animations for modal panels
 */

import { gsap } from 'gsap';

class ModalAnimations {
  constructor() {
    this.animations = new Map();
    this.initializeModals();
  }

  initializeModals() {
    // List of modals to animate
    const modalIds = [
      'bilan-panel',
      'loans-panel',
      'realtime-budget-panel',
      'budget-states-panel',
      'journal-panel',
      'city-map-panel',
      'administrator-panel'
    ];

    modalIds.forEach(modalId => {
      this.setupModal(modalId);
    });
  }

  setupModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      return; // Modal doesn't exist, skip
    }

    // Find wrapper - supports various naming conventions
    const wrapper = modal.querySelector(`
      .bilan-panel-wrapper, 
      .loans-panel-wrapper, 
      .realtime-budget-wrapper, 
      .realtime-budget-panel-wrapper,
      .budget-states-wrapper,
      .budget-states-panel-wrapper,
      .journal-wrapper,
      .journal-panel-wrapper,
      .city-map-wrapper,
      .city-map-panel-wrapper,
      .administrator-panel-wrapper
    `);
    
    // Find header - supports various naming conventions
    const header = wrapper?.querySelector(`
      .bilan-panel-header, 
      .loans-panel-header, 
      .realtime-budget-header,
      .realtime-budget-panel-header,
      .budget-states-header,
      .budget-states-panel-header,
      .journal-header,
      .journal-panel-header,
      .city-map-header,
      .city-map-panel-header,
      .administrator-panel-header
    `);
    
    // Find content - supports various naming conventions
    const content = wrapper?.querySelector(`
      .bilan-panel-content, 
      .loans-panel-content, 
      .realtime-budget-content,
      .realtime-budget-panel-content,
      .budget-states-content,
      .budget-states-panel-content,
      .journal-content,
      .journal-panel-content,
      .city-map-content,
      .city-map-panel-content,
      .administrator-panel-content
    `);

    if (!wrapper) {
      return; // No wrapper found, skip
    }

    // Set initial hidden state
    this.setInitialState(modal, wrapper, header, content);

    // Store animation data
    this.animations.set(modalId, {
      modal,
      wrapper,
      header,
      content,
      isAnimating: false,
      timeline: null
    });

    // Observe class changes
    this.observeModal(modalId);
  }

  setInitialState(modal, wrapper, header, content) {
    // Set modal overlay initial state
    gsap.set(modal, {
      opacity: 0,
      visibility: 'hidden',
      pointerEvents: 'none'
    });

    // Set wrapper initial state (scaled down and slightly transparent)
    gsap.set(wrapper, {
      opacity: 0,
      scale: 0.9,
      y: 20
    });

    // Set header initial state
    if (header) {
      gsap.set(header, {
        opacity: 0,
        y: -15
      });
    }

    // Set content initial state
    if (content) {
      gsap.set(content, {
        opacity: 0,
        y: 15
      });
    }
  }

  observeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isActive = modal.classList.contains('active');
          const animationData = this.animations.get(modalId);

          if (!animationData) return;

          if (isActive && !animationData.isAnimating) {
            this.animateIn(modalId);
          } else if (!isActive && !animationData.isAnimating) {
            this.animateOut(modalId);
          }
        }
      });
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  animateIn(modalId) {
    const data = this.animations.get(modalId);
    if (!data || data.isAnimating) return;

    data.isAnimating = true;

    // Kill any existing animations
    if (data.timeline) {
      data.timeline.kill();
    }

    // Create new timeline
    data.timeline = gsap.timeline({
      onComplete: () => {
        data.isAnimating = false;
      }
    });

    // Show modal overlay first
    data.timeline.set(data.modal, {
      visibility: 'visible',
      pointerEvents: 'auto'
    });

    // Fade in overlay background
    data.timeline.to(data.modal, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out'
    });

    // Animate wrapper - scale up with fade and slight bounce
    data.timeline.to(data.wrapper, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.5,
      ease: 'back.out(1.4)' // Slight bounce for elegance
    }, '-=0.2'); // Start slightly before overlay finishes

    // Animate header - fade and slide down
    if (data.header) {
      data.timeline.to(data.header, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, '-=0.3'); // Start during wrapper animation
    }

    // Animate content - fade and slide up
    if (data.content) {
      data.timeline.to(data.content, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, '-=0.3'); // Start during wrapper animation

      // Stagger children if they exist
      const children = data.content.children;
      if (children.length > 0) {
        gsap.set(children, { opacity: 0, y: 10 });
        data.timeline.to(children, {
          opacity: 1,
          y: 0,
          duration: 0.25,
          stagger: 0.03,
          ease: 'power1.out'
        }, '-=0.2'); // Start slightly after content
      }
    }
  }

  animateOut(modalId) {
    const data = this.animations.get(modalId);
    if (!data || data.isAnimating) return;

    data.isAnimating = true;

    // Kill any existing animations
    if (data.timeline) {
      data.timeline.kill();
    }

    // Create new timeline
    data.timeline = gsap.timeline({
      onComplete: () => {
        data.isAnimating = false;
        // Reset to hidden state
        gsap.set(data.modal, {
          visibility: 'hidden',
          pointerEvents: 'none'
        });
        this.setInitialState(data.modal, data.wrapper, data.header, data.content);
      }
    });

    // Fade out header and content first
    if (data.header) {
      data.timeline.to(data.header, {
        opacity: 0,
        y: -10,
        duration: 0.2,
        ease: 'power2.in'
      });
    }

    if (data.content) {
      data.timeline.to(data.content, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        ease: 'power2.in'
      }, '-=0.2'); // Simultaneous with header
    }

    // Scale down wrapper with fade
    data.timeline.to(data.wrapper, {
      opacity: 0,
      scale: 0.95,
      y: 10,
      duration: 0.3,
      ease: 'power2.in'
    }, '-=0.1');

    // Fade out overlay background
    data.timeline.to(data.modal, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in'
    }, '-=0.1');
  }
}

// Export singleton instance
const modalAnimations = new ModalAnimations();

export default modalAnimations;

