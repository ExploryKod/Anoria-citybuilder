/**
 * TresoreriePanel — popup trésorerie temps réel (DOM + événements).
 * Rendu : TresoreriePresenter.js
 */

import {
  renderLoanInterestDetail,
  renderTresorerieError,
  renderTresorerieFromData,
  financialHealthStatusLabel,
} from './TresoreriePresenter.js';

export { financialHealthStatusLabel as getHealthStatusText };

/**
 * @type {{
 *   accounting: object,
 *   housing: object,
 *   popupManager?: object | null,
 *   gameStore?: object | null,
 * } | null}
 */
let deps = null;

/**
 * @param {{
 *   accounting: object,
 *   housing: object,
 *   popupManager?: object | null,
 *   gameStore?: object | null,
 * }} panelDeps
 */
export function initTresoreriePopup(panelDeps) {
  deps = panelDeps;
  const { popupManager } = deps;

  const realtimeBudgetBtn = document.getElementById('realtime-budget-btn');
  const realtimeBudgetPanel = document.getElementById('realtime-budget-panel');
  const realtimeBudgetCloseBtn = document.querySelector('.realtime-budget-close-btn');
  const realtimeFundsEl = document.getElementById('realtime-funds');

  if (!realtimeBudgetBtn || !realtimeBudgetPanel || !realtimeBudgetCloseBtn || !realtimeFundsEl) {
    console.warn('Real-time budget popup elements not found');
    return;
  }

  realtimeBudgetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.target === realtimeBudgetBtn || realtimeBudgetBtn.contains(e.target)) {
      realtimeBudgetPanel.classList.toggle('active');
      realtimeBudgetBtn.classList.toggle('active');

      if (realtimeBudgetPanel.classList.contains('active')) {
        popupManager?.forceOpenPopup('realtime-budget-panel');
        updateTresorerie();
      } else {
        popupManager?.forceClosePopup('realtime-budget-panel');
      }
    }
  });

  realtimeBudgetCloseBtn.addEventListener('click', () => {
    realtimeBudgetPanel.classList.remove('active');
    realtimeBudgetBtn.classList.remove('active');
    popupManager?.forceClosePopup('realtime-budget-panel');
  });

  realtimeBudgetPanel.addEventListener('click', (e) => {
    if (e.target === realtimeBudgetPanel) {
      realtimeBudgetPanel.classList.remove('active');
      realtimeBudgetBtn.classList.remove('active');
    }
  });

  setInterval(() => {
    if (realtimeBudgetPanel.classList.contains('active')) {
      updateTresorerie();
    }
  }, 1000);
}

/**
 * Met à jour l'affichage du budget en temps réel
 */
export async function updateTresorerie() {
  if (!deps?.accounting || !deps?.housing) {
    console.warn('[TresoreriePanel] deps not initialized');
    return;
  }

  const { accounting, housing, gameStore } = deps;

  try {
    const [budgetData, financialHealth, incomeBreakdown, expenseBreakdown] = await Promise.all([
      accounting.getTreasurySnapshot(),
      accounting.getFinancialHealth(),
      accounting.getIncomeBreakdown(),
      accounting.getExpenseBreakdown(),
    ]);

    let population = 0;
    let populationError = false;
    try {
      population = await housing.getCityTotalPopulation();
    } catch (error) {
      populationError = true;
      console.error('[TresoreriePanel] Error fetching population from Housing BC:', error);
      if (gameStore && typeof gameStore.getLatestGameItemByField === 'function') {
        console.warn('[TresoreriePanel] FALLING BACK to gameStore (may be stale)');
        const gamePop = await gameStore.getLatestGameItemByField('population');
        population = gamePop !== null && gamePop !== undefined ? gamePop : 0;
      } else {
        console.error('[TresoreriePanel] Housing BC and gameStore unavailable! Population set to 0');
        population = 0;
      }
    }

    if (
      !renderTresorerieFromData({
        treasurySnapshot: budgetData,
        financialHealth,
        incomeBreakdown,
        expenseBreakdown,
        population,
        populationError,
      })
    ) {
      console.warn('Realtime budget elements not found');
      return;
    }

    const activeLoans = await accounting.getActiveLoans();
    renderLoanInterestDetail(activeLoans);
  } catch (error) {
    console.error('Error updating real-time budget:', error);
    renderTresorerieError();
  }
}
