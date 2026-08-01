import { getPopupManager, registerAppFunction } from '../../../js/acl/appRuntime.js';
import { getBalanceSheet } from '../../../js/acl/accounting.js';
import { getFinancialHealth, getTreasurySnapshot } from '../../../js/acl/accountingGame.js';
import { renderBilan } from './BilanPresenter.js';
import { updateTresorerie } from '../tresorerie/TresoreriePanel.js';

let balanceSheetFiltersInitialized = false;

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
  try {
    const [financialHealth, currentBudget, balanceSheet] = await Promise.all([
      getFinancialHealth(),
      getTreasurySnapshot(),
      getBalanceSheet(),
    ]);

    await renderBilan({
      balanceSheet,
      turn: currentBudget.turn || 0,
      treasurySnapshot: currentBudget,
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

    updateTresorerie();
  } catch (error) {
    console.error('Error updating budget display:', error);
  }
}

export function initBilanPopup() {
  const budgetBtn = document.getElementById('bilan-btn');
  const budgetPanel = document.getElementById('bilan-panel');
  const budgetPanelCloseBtn = document.querySelector('.bilan-panel-close-btn');

  if (!budgetBtn || !budgetPanel || !budgetPanelCloseBtn) {
    console.warn('Balance sheet popup elements not found');
    return;
  }

  initBilanFilters();

  budgetBtn.addEventListener('click', () => {
    budgetPanel.classList.add('active');

    if (getPopupManager()) {
      getPopupManager().forceOpenPopup('bilan-panel');
    }

    updateBudgetDisplay();
  });

  budgetPanelCloseBtn.addEventListener('click', () => {
    budgetPanel.classList.remove('active');

    if (getPopupManager()) {
      getPopupManager().forceClosePopup('bilan-panel');
    }
  });

  budgetPanel.addEventListener('click', (e) => {
    if (e.target === budgetPanel) {
      budgetPanel.classList.remove('active');

      if (getPopupManager()) {
        getPopupManager().forceClosePopup('bilan-panel');
      }
    }
  });
}

registerAppFunction('updateBudgetDisplay', updateBudgetDisplay);
