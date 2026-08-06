import { registerAppFunction } from './composition/sessionShell.js'

import { initPWA } from './pwa.js'
import { gsap } from 'gsap'
import infoPanelAnimations from './presentation/dom/shell/InfoPanelAnimations.js'
import modalAnimations from './presentation/dom/shell/ModalAnimations.js'
import './presentation/dom/shell/OrientationToast.js'

const app = document.querySelector('#game-window')

initPWA(app)

/**
 * Positions the legend buttons container based on the toolbar width
 * On mobile/tablette, buttons are positioned in bottom-left corner via CSS
 */
function positionLegendButtons() {
  const toolbar = document.getElementById('toolbar');
  const legendContainer = document.querySelector('.legend-btns-container');
  
  if (!toolbar || !legendContainer) {
    return;
  }
  
  // On mobile/tablette (max-width: 1024px), CSS handles positioning
  // Check if we're on mobile/tablette
  const isMobileOrTablet = window.matchMedia('(max-width: 1024px)').matches;
  
  if (isMobileOrTablet) {
    // CSS handles positioning on mobile/tablette, don't override
    return;
  }
  
  // Desktop: CSS now handles centering (same as footer)
  // Remove any inline styles that might override CSS
  legendContainer.style.left = '';
  legendContainer.style.right = '';
}

/**
 * Animation presets - different cool animation styles
 */
const ANIMATION_PRESETS = {
  // Current: Slide in from left with bounce
  slideBounce: (buttons) => {
    gsap.set(buttons, { opacity: 0, x: -200, scale: 0.8 });
    gsap.to(buttons, {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.6,
      stagger: 0.15,
      ease: 'back.out(1.7)'
    });
  },

  // Elastic spring effect
  elastic: (buttons) => {
    gsap.set(buttons, { opacity: 0, y: -50, rotationX: -90 });
    gsap.to(buttons, {
      opacity: 1,
      y: 0,
      rotationX: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'elastic.out(1, 0.5)'
    });
  },

  // Scale up with blur (smooth reveal) - Refined for Anoria's professional aesthetic
  // Creates a sophisticated "materialization" effect perfect for UI appearing after loading
  scaleBlur: (buttons) => {
    gsap.set(buttons, { 
      opacity: 0, 
      scale: 0.5, 
      filter: 'blur(8px)',
      rotation: -90,
      y: 20 // Subtle vertical offset for depth
    });
    gsap.to(buttons, {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      rotation: 0,
      y: 0,
      duration: 0.65,
      stagger: 0.1, // Slightly faster stagger for better flow
      ease: 'power2.out' // Smooth, professional easing
    });
  },

  // Slide from multiple directions
  multiDirection: (buttons) => {
    const directions = [
      { x: -200, y: 0 },
      { x: 0, y: -100 },
      { x: 200, y: 0 }
    ];
    
    buttons.forEach((btn, i) => {
      const dir = directions[i] || directions[0];
      gsap.set(btn, { opacity: 0, x: dir.x, y: dir.y, scale: 0.5 });
      gsap.to(btn, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.6,
        delay: i * 0.15,
        ease: 'back.out(1.4)'
      });
    });
  },

  // Wave effect (cascading from top)
  wave: (buttons) => {
    gsap.set(buttons, { opacity: 0, y: -100, rotation: -15, scale: 0.8 });
    gsap.to(buttons, {
      opacity: 1,
      y: 0,
      rotation: 0,
      scale: 1,
      duration: 0.5,
      stagger: {
        amount: 0.4,
        from: 'start'
      },
      ease: 'sine.out'
    });
  },

  // Flip card effect
  flipCard: (buttons) => {
    gsap.set(buttons, { 
      opacity: 0, 
      rotationY: -90,
      transformPerspective: 1000,
      transformOrigin: 'center center'
    });
    gsap.to(buttons, {
      opacity: 1,
      rotationY: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power2.inOut'
    });
  },

  // Pop with color flash (energetic)
  popFlash: (buttons) => {
    gsap.set(buttons, { opacity: 0, scale: 0 });
    
    buttons.forEach((btn, i) => {
      const tl = gsap.timeline({ delay: i * 0.1 });
      tl.to(btn, {
        opacity: 1,
        scale: 1.2,
        duration: 0.3,
        ease: 'power2.out'
      })
      .to(btn, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.in'
      });
      
      // Add a subtle glow effect
      gsap.to(btn, {
        boxShadow: '0 0 20px rgba(251, 129, 34, 0.6)',
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        delay: i * 0.1 + 0.3
      });
    });
  },

  // Smooth fade with slide (elegant)
  fadeSlide: (buttons) => {
    gsap.set(buttons, { opacity: 0, x: -150, y: 20 });
    gsap.to(buttons, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: 'power1.out'
    });
  }
};

function isMobileLegendViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Shows the legend buttons with GSAP staggered animation after scene loads
 * @param {string} animationType - Type of animation to use (default: 'slideBounce')
 */
function showLegendButtons(animationType = 'slideBounce') {
  if (!isMobileLegendViewport()) {
    return;
  }

  const legendContainer = document.querySelector('.legend-btns-container');
  if (!legendContainer) {
    return;
  }
  
  // Position buttons first
  positionLegendButtons();
  
  // Show the container
  legendContainer.style.display = 'flex';
  
  // Get all button elements (the three legend buttons)
  const buttons = legendContainer.querySelectorAll('.legend-btns');
  
  // Get the animation function or fallback to slideBounce
  const animate = ANIMATION_PRESETS[animationType] || ANIMATION_PRESETS.slideBounce;
  animate(buttons);
}

// Animation Analysis for Anoria City Builder:
// - scaleBlur: Best choice - smooth materialization effect, professional, 
//   matches the game's polished aesthetic. The blur-to-focus creates a sense
//   of UI elements "appearing" as the game world becomes ready, perfect for 
//   post-loading animations. The subtle rotation adds sophistication.
// - fadeSlide: Alternative - elegant and smooth, very professional
// - elastic/wave: Too playful for a serious city-building game
// - popFlash: Too energetic, might distract from gameplay
// - flipCard: Interesting but feels more like a card game
// - multiDirection: Could work but scaleBlur is more refined
const DEFAULT_ANIMATION = 'scaleBlur';

// Watch for loader to be hidden, then show buttons
function initializeLegendButtons() {
  const loaderModal = document.getElementById('chronos-loader-modal');
  const legendContainer = document.querySelector('.legend-btns-container');
  
  if (!loaderModal || !legendContainer) {
    return;
  }
  
  // Use MutationObserver to watch for when loader becomes hidden
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const isHidden = loaderModal.classList.contains('hidden');
        if (isHidden && !legendContainer.classList.contains('visible') && isMobileLegendViewport()) {
          // Loader is now hidden, show buttons after the fade-out transition completes
          // The loader has a 0.5s opacity transition, wait for it to complete
          setTimeout(() => {
            showLegendButtons(DEFAULT_ANIMATION);
          }, 550); // Wait for transition (500ms) + small buffer
        }
      }
    });
  });
  
  // Start observing the loader modal
  observer.observe(loaderModal, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Also position buttons on initial load (they'll be hidden but positioned correctly)
  setTimeout(positionLegendButtons, 100);
  
  // Expose animation testing to console for easy experimentation
  // Usage: app.testAnimation('elastic') or app.testAnimation('wave')
  registerAppFunction('testAnimation', (animationType) => {
    const legendContainer = document.querySelector('.legend-btns-container');
    if (legendContainer) {
      legendContainer.style.display = 'none';
      const buttons = legendContainer.querySelectorAll('.legend-btns');
      buttons.forEach(btn => {
        gsap.killTweensOf(btn);
        btn.style.transform = '';
        btn.style.opacity = '';
        btn.style.filter = '';
        btn.style.boxShadow = '';
      });
      setTimeout(() => {
        showLegendButtons(animationType);
      }, 100);
    }
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLegendButtons);
} else {
  // DOM already loaded
  initializeLegendButtons();
}

// Reposition on window resize with debounce
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    positionLegendButtons();
  }, 100);
});
