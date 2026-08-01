import { requireSessionHousingApi } from '../../../../composition/sessionRuntime.js';
/**
 * TresoreriePanel — popup trésorerie temps réel (DOM + événements).
 * Rendu : TresoreriePresenter.js
 */
export { financialHealthStatusLabel as getHealthStatusText };

/**
 * Initialise le popup de budget en temps réel
 */
export function initTresoreriePopup() {
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
        if (getPopupManager()) {
          getPopupManager().forceOpenPopup('realtime-budget-panel');
        }
        updateTresorerie();
      } else if (getPopupManager()) {
        getPopupManager().forceClosePopup('realtime-budget-panel');
      }
    }
  });

  realtimeBudgetCloseBtn.addEventListener('click', () => {
    realtimeBudgetPanel.classList.remove('active');
    realtimeBudgetBtn.classList.remove('active');

    if (getPopupManager()) {
      getPopupManager().forceClosePopup('realtime-budget-panel');
    }
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
  try {
    const [budgetData, financialHealth, incomeBreakdown, expenseBreakdown] = await Promise.all([
      requireSessionAccountingApi().getTreasurySnapshot(),
      requireSessionAccountingApi().getFinancialHealth(),
      requireSessionAccountingApi().getIncomeBreakdown(),
      requireSessionAccountingApi().getExpenseBreakdown(),
    ]);

    let population = 0;
    let populationError = false;
    try {
      population = await getCityTotalPopulation();
    } catch (error) {
      populationError = true;
      console.error('[TresoreriePanel] Error fetching population from Housing BC:', error);
      const gameStore = getGameStore();
      if (gameStore && typeof gameStore.getLatestGameItemByField === 'function') {
        console.warn('[TresoreriePanel] ⚠️ FALLING BACK to gameStore (may be stale)');
        const gamePop = await gameStore.getLatestGameItemByField('population');
        population = gamePop !== null && gamePop !== undefined ? gamePop : 0;
      } else {
        console.error('[TresoreriePanel] ❌ Housing BC and gameStore unavailable! Population set to 0');
        population = 0;
      }
    }

    if (!requireSessionHousingApi().renderTresorerieFromData({
      treasurySnapshot: budgetData,
      financialHealth,
      incomeBreakdown,
      expenseBreakdown,
      population,
      populationError,
    })) {
      console.warn('Realtime budget elements not found');
      return;
    }

    const activeLoans = await requireSessionAccountingApi().getActiveLoans();
    renderLoanInterestDetail(activeLoans);
  } catch (error) {
    console.error('Error updating real-time budget:', error);
    requireSessionHousingApi().renderTresorerieError();
  }
}
