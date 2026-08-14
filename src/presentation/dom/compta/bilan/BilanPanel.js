import { renderBilan } from './BilanPresenter.js';
import { createModalFocusSession } from '../../shell/modalFocus.js';

/**
 * @type {{
 *   accounting: object,
 *   construction: object,
 *   popupManager?: object | null,
 * } | null}
 */
let deps = null;

let balanceSheetFiltersInitialized = false;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let bilanFocusSession = null;

function initBilanFilters() {
  if (balanceSheetFiltersInitialized) return;
  balanceSheetFiltersInitialized = true;

  const filterButtons = document.querySelectorAll('.balance-filter-btn');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter');

      filterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      applyBalanceSheetFilter(filter);
    });
  });
}

function applyBalanceSheetFilter(filter) {
  const actifSection = document.querySelector('.balance-sheet-actif');
  const passifSection = document.querySelector('.balance-sheet-passif');
  const totalActif = document.querySelector('.balance-sheet-total-actif');
  const totalPassif = document.querySelector('.balance-sheet-total-passif');

  actifSection?.classList.remove('hidden');
  passifSection?.classList.remove('hidden');
  totalActif?.classList.remove('hidden');
  totalPassif?.classList.remove('hidden');

  switch (filter) {
    case 'actif':
      passifSection?.classList.add('hidden');
      totalPassif?.classList.add('hidden');
      break;
    case 'passif':
      actifSection?.classList.add('hidden');
      totalActif?.classList.add('hidden');
      break;
    case 'all':
    default:
      break;
  }
}

export async function updateBudgetDisplay() {
  if (!deps?.accounting || !deps?.construction) {
    console.warn('[BilanPanel] deps not initialized');
    return;
  }

  const { accounting, construction } = deps;

  try {
    const [financialHealth, currentBudget, balanceSheet] = await Promise.all([
      accounting.getFinancialHealth(),
      accounting.getTreasurySnapshot(),
      accounting.getBalanceSheet(),
    ]);

    await renderBilan({
      balanceSheet,
      turn: currentBudget.turn || 0,
      treasurySnapshot: currentBudget,
      accounting,
      construction,
    });

    const healthIndicatorEl = document.getElementById('bilan-health-indicator');
    const healthStatusEl = healthIndicatorEl?.querySelector('.health-status');

    if (healthIndicatorEl && healthStatusEl) {
      healthStatusEl.textContent = financialHealth.message;

      healthIndicatorEl.classList.remove('warning', 'critical');

      if (financialHealth.status === 'critical') {
        healthIndicatorEl.classList.add('critical');
      } else if (
        financialHealth.status === 'warning' ||
        financialHealth.status === 'deficit'
      ) {
        healthIndicatorEl.classList.add('warning');
      }
    }

  } catch (error) {
    console.error('Error updating budget display:', error);
  }
}

/**
 * @param {{
 *   accounting: object,
 *   construction: object,
 *   popupManager?: object | null,
 * }} panelDeps
 */
export function initBilanPopup(panelDeps) {
  deps = panelDeps;
  const { popupManager } = deps;

  const budgetBtn = document.getElementById('bilan-btn');
  const budgetPanel = document.getElementById('bilan-panel');
  const budgetPanelCloseBtn = document.querySelector('.bilan-panel-close-btn');

  if (!budgetBtn || !budgetPanel || !budgetPanelCloseBtn) {
    console.warn('Balance sheet popup elements not found');
    return;
  }

  initBilanFilters();

  function openBilan() {
    budgetPanel.classList.add('active');
    popupManager?.forceOpenPopup('bilan-panel');
    updateBudgetDisplay();
    bilanFocusSession?.release({ restoreFocus: false });
    bilanFocusSession = createModalFocusSession({
      panel: budgetPanel,
      onEscape: closeBilan,
      initialFocus: '.bilan-panel-close-btn',
    });
  }

  function closeBilan() {
    bilanFocusSession?.release();
    bilanFocusSession = null;
    budgetPanel.classList.remove('active');
    popupManager?.forceClosePopup('bilan-panel');
  }

  budgetBtn.addEventListener('click', () => {
    openBilan();
  });

  budgetPanelCloseBtn.addEventListener('click', () => {
    closeBilan();
  });

  budgetPanel.addEventListener('click', (e) => {
    if (e.target === budgetPanel) {
      closeBilan();
    }
  });
}
