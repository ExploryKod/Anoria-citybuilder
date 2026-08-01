/**
 * Administrator Panel — shell + navigation between admin sections.
 */

import {
  initializeFoodTraceabilityTabs,
  loadFoodTraceabilityEntries,
} from './food-traceability/FoodTraceabilityPanel.js';

/**
 * @param {{
 *   popupManager?: object | null,
 *   registerAppFunction?: (name: string, fn: Function) => void,
 * }} deps
 */
export function initAdministratorPanel(deps = {}) {
  if (typeof document === 'undefined') return;

  const { popupManager, registerAppFunction } = deps;

  const administratorPanel = document.getElementById('administrator-panel');
  const administratorCloseBtn = document.getElementById('administrator-panel-close-btn');
  const navButtons = document.querySelectorAll('.administrator-nav-btn');
  const sections = document.querySelectorAll('.administrator-section');

  if (!administratorPanel || !administratorCloseBtn) {
    console.warn('Administrator panel elements not found');
    return;
  }

  function openPanel() {
    administratorPanel.classList.add('active');
    popupManager?.forceOpenPopup('administrator-panel');
    if (sections.length > 0) {
      showSection('finances');
    }
  }

  function closePanel() {
    administratorPanel.classList.remove('active');
    popupManager?.forceClosePopup('administrator-panel');
  }

  function showSection(sectionId) {
    sections.forEach((section) => section.classList.remove('active'));
    navButtons.forEach((btn) => btn.classList.remove('selected'));

    const targetSection = document.getElementById(`admin-section-${sectionId}`);
    if (targetSection) {
      targetSection.classList.add('active');

      if (sectionId === 'food-traceability') {
        initializeFoodTraceabilityTabs();
        const activeFilterBtn = document.querySelector('.food-traceability-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadFoodTraceabilityEntries(currentPeriod);
      }
    }

    const targetButton = document.querySelector(`[data-section="${sectionId}"]`);
    targetButton?.classList.add('selected');
  }

  administratorCloseBtn.addEventListener('click', closePanel);

  navButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = btn.dataset.section;
      if (sectionId) showSection(sectionId);
    });
  });

  administratorPanel.addEventListener('click', (e) => {
    if (e.target === administratorPanel) closePanel();
  });

  registerAppFunction?.('openAdministratorPanel', openPanel);
  registerAppFunction?.('closeAdministratorPanel', closePanel);
  registerAppFunction?.('showAdministratorSection', showSection);

  document.getElementById('administrator-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPanel();
  });
}
