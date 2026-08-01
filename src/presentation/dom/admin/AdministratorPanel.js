/**
 * Administrator Panel — shell + navigation between admin sections.
 */

import { getPopupManager, registerAppFunction } from '../../../composition/facades/appRuntime.js';
import {
  initializeFoodTraceabilityTabs,
  loadFoodTraceabilityEntries,
} from './food-traceability/FoodTraceabilityPanel.js';

function initAdministratorPanel() {
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
    getPopupManager()?.forceOpenPopup('administrator-panel');
    if (sections.length > 0) {
      showSection('finances');
    }
  }

  function closePanel() {
    administratorPanel.classList.remove('active');
    getPopupManager()?.forceClosePopup('administrator-panel');
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

  registerAppFunction('openAdministratorPanel', openPanel);
  registerAppFunction('closeAdministratorPanel', closePanel);
  registerAppFunction('showAdministratorSection', showSection);

  document.getElementById('administrator-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPanel();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdministratorPanel);
} else {
  initAdministratorPanel();
}

export { initAdministratorPanel };
