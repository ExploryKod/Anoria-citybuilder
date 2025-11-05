import { initPWA } from './pwa.js'
import { gsap } from 'gsap'

const app = document.querySelector('#game-window')

initPWA(app)

/**
 * Positions the legend buttons container based on the toolbar width
 */
function positionLegendButtons() {
  const toolbar = document.getElementById('toolbar');
  const legendContainer = document.querySelector('.legend-btns-container');
  
  if (!toolbar || !legendContainer) {
    return;
  }
  
  // Get the actual toolbar width (including padding)
  const toolbarRect = toolbar.getBoundingClientRect();
  const toolbarWidth = toolbarRect.width;
  
  // Set the left position: toolbar width + 6px gap
  const leftPosition = toolbarWidth + 6;
  legendContainer.style.left = `${leftPosition}px`;
}

/**
 * Shows the legend buttons with GSAP staggered animation after scene loads
 */
function showLegendButtons() {
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
  
  // Set initial state for all buttons (hidden, off-screen to the left)
  gsap.set(buttons, {
    opacity: 0,
    x: -200,
    scale: 0.8
  });
  
  // Create a timeline for staggered animation
  const tl = gsap.timeline({
    defaults: {
      ease: 'power3.out'
    }
  });
  
  // Animate each button one after another with stagger
  tl.to(buttons, {
    opacity: 1,
    x: 0,
    scale: 1,
    duration: 0.6,
    stagger: 0.15, // 0.15s delay between each button
    ease: 'back.out(1.7)' // Nice bounce effect
  });
}

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
        if (isHidden && !legendContainer.classList.contains('visible')) {
          // Loader is now hidden, show buttons after the fade-out transition completes
          // The loader has a 0.5s opacity transition, wait for it to complete
          setTimeout(() => {
            showLegendButtons();
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
  resizeTimeout = setTimeout(positionLegendButtons, 100);
});
