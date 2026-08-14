/**
 * Administrator Panel — shell + APG tabs navigation between admin sections.
 * Categories: arrow keys / Home / End on the tablist; Tab enters the active tabpanel only.
 */

import {
  initializeFoodTraceabilityTabs,
  loadFoodTraceabilityEntries,
} from './food-traceability/FoodTraceabilityPanel.js';
import { createModalFocusSession, getFocusableElements } from '../shell/modalFocus.js';

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
  const navButtons = [...document.querySelectorAll('.administrator-nav-btn')];
  const sections = [...document.querySelectorAll('.administrator-section')];
  const tablist = document.querySelector('.administrator-nav-buttons');

  if (!administratorPanel || !administratorCloseBtn || !tablist) {
    console.warn('Administrator panel elements not found');
    return;
  }

  /** @type {ReturnType<typeof createModalFocusSession> | null} */
  let focusSession = null;

  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Catégories du panneau administrateur');

  navButtons.forEach((btn) => {
    const sectionId = btn.dataset.section;
    if (!sectionId) return;
    const panelId = `admin-section-${sectionId}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-controls', panelId);
    btn.id = btn.id || `admin-nav-${sectionId}`;
  });

  sections.forEach((section) => {
    const sectionId = section.id.replace(/^admin-section-/, '');
    const tab = navButtons.find((btn) => btn.dataset.section === sectionId);
    section.setAttribute('role', 'tabpanel');
    if (tab?.id) {
      section.setAttribute('aria-labelledby', tab.id);
    }
  });

  /**
   * @param {string} sectionId
   * @param {{ focusTab?: boolean, focusPanel?: boolean }} [options]
   */
  function showSection(sectionId, { focusTab = false, focusPanel = false } = {}) {
    sections.forEach((section) => {
      const isActive = section.id === `admin-section-${sectionId}`;
      section.classList.toggle('active', isActive);
      if (isActive) {
        section.removeAttribute('hidden');
        section.setAttribute('aria-hidden', 'false');
      } else {
        section.setAttribute('hidden', '');
        section.setAttribute('aria-hidden', 'true');
      }
    });

    navButtons.forEach((btn) => {
      const isSelected = btn.dataset.section === sectionId;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.tabIndex = isSelected ? 0 : -1;
    });

    if (sectionId === 'food-traceability') {
      initializeFoodTraceabilityTabs();
      const activeFilterBtn = document.querySelector('.food-traceability-filter-btn.active');
      const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
      loadFoodTraceabilityEntries(currentPeriod);
    }

    const selectedTab = navButtons.find((btn) => btn.dataset.section === sectionId);
    const activePanel = document.getElementById(`admin-section-${sectionId}`);

    if (focusTab) {
      selectedTab?.focus();
      return;
    }

    if (focusPanel && activePanel) {
      const panelFocusables = getFocusableElements(activePanel);
      const first = panelFocusables[0];
      if (first) {
        first.focus();
        return;
      }
      if (!activePanel.hasAttribute('tabindex')) {
        activePanel.setAttribute('tabindex', '-1');
      }
      activePanel.focus();
    }
  }

  /**
   * @param {number} delta
   */
  function moveTabSelection(delta) {
    if (navButtons.length === 0) return;
    const currentIndex = Math.max(
      0,
      navButtons.findIndex((btn) => btn.getAttribute('aria-selected') === 'true'),
    );
    const nextIndex = (currentIndex + delta + navButtons.length) % navButtons.length;
    const next = navButtons[nextIndex];
    const sectionId = next?.dataset.section;
    if (!sectionId) return;
    showSection(sectionId, { focusTab: true });
  }

  function openPanel() {
    administratorPanel.classList.add('active');
    popupManager?.forceOpenPopup('administrator-panel');
    showSection('finances');
    focusSession?.release({ restoreFocus: false });
    focusSession = createModalFocusSession({
      panel: administratorPanel,
      onEscape: closePanel,
      // Land on the category tablist so arrows switch sections; Tab enters the panel (e.g. Carte).
      initialFocus: '#admin-nav-finances',
    });
  }

  function closePanel() {
    administratorPanel.classList.remove('active');
    popupManager?.forceClosePopup('administrator-panel');
    focusSession?.release();
    focusSession = null;
  }

  administratorCloseBtn.addEventListener('click', closePanel);

  navButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = btn.dataset.section;
      if (sectionId) {
        showSection(sectionId, { focusTab: true });
      }
    });
  });

  tablist.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('administrator-nav-btn')) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveTabSelection(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveTabSelection(-1);
        break;
      case 'Home':
        event.preventDefault();
        if (navButtons[0]?.dataset.section) {
          showSection(navButtons[0].dataset.section, { focusTab: true });
        }
        break;
      case 'End':
        event.preventDefault();
        {
          const last = navButtons[navButtons.length - 1];
          if (last?.dataset.section) {
            showSection(last.dataset.section, { focusTab: true });
          }
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        {
          const sectionId = target.dataset.section;
          if (sectionId) {
            showSection(sectionId, { focusPanel: true });
          }
        }
        break;
      default:
        break;
    }
  });

  administratorPanel.addEventListener('click', (e) => {
    if (e.target === administratorPanel) closePanel();
  });

  // Inactive panels start hidden (CSS also hides non-.active).
  sections.forEach((section) => {
    if (!section.classList.contains('active')) {
      section.setAttribute('hidden', '');
      section.setAttribute('aria-hidden', 'true');
    }
  });
  showSection('finances');

  registerAppFunction?.('openAdministratorPanel', openPanel);
  registerAppFunction?.('closeAdministratorPanel', closePanel);
  registerAppFunction?.('showAdministratorSection', (sectionId) => {
    showSection(sectionId, { focusTab: true });
  });

  document.getElementById('administrator-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPanel();
  });
}
