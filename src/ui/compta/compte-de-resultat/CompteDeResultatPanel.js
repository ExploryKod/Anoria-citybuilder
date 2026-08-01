/**
 * CompteDeResultatPanel — popup compte de résultat (DOM + événements).
 * Rendu : CompteDeResultatPresenter.js
 */

import { getPopupManager, registerAppFunction } from '../../../js/acl/appRuntime.js';
import {
  getFinancialStatementsHistory,
  getIncomeStatement,
} from '../../../js/acl/accounting.js';
import {
  renderFinancialStatementsBundles,
  renderBudgetSummary,
} from './CompteDeResultatPresenter.js';

/**
 * Initialise le popup des états budgétaires
 */
export function initBudgetStatesPopup() {
  const budgetStatesBtn = document.getElementById('budget-states-btn');
  const budgetStatesPanel = document.getElementById('budget-states-panel');
  const budgetStatesCloseBtn = document.querySelector('.budget-states-close-btn');
  const filterButtons = document.querySelectorAll('.budget-filter-btn');

  if (!budgetStatesBtn || !budgetStatesPanel || !budgetStatesCloseBtn) {
    console.warn('Budget states popup elements not found');
    return;
  }

  budgetStatesBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.target === budgetStatesBtn || budgetStatesBtn.contains(e.target)) {
      budgetStatesPanel.classList.toggle('active');
      budgetStatesBtn.classList.toggle('active');

      if (budgetStatesPanel.classList.contains('active')) {
        if (getPopupManager()) {
          getPopupManager().forceOpenPopup('budget-states-panel');
        }
        await loadBudgetStates('3', true);
        await updateFilterButtonLabels();
      } else if (getPopupManager()) {
        getPopupManager().forceClosePopup('budget-states-panel');
      }
    }
  });

  budgetStatesCloseBtn.addEventListener('click', () => {
    budgetStatesPanel.classList.remove('active');
    budgetStatesBtn.classList.remove('active');
    if (getPopupManager()) {
      getPopupManager().forceClosePopup('budget-states-panel');
    }
  });

  budgetStatesPanel.addEventListener('click', (e) => {
    if (e.target === budgetStatesPanel) {
      budgetStatesPanel.classList.remove('active');
      budgetStatesBtn.classList.remove('active');
    }
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const period = btn.dataset.period;
      await loadBudgetStates(period, false);
      await updateFilterButtonLabels();
    });
  });

  const refreshBtn = document.querySelector('.budget-global-refresh-btn');
  refreshBtn?.addEventListener('click', () => {
    void refreshBudgetStatesModal();
  });

  updateFilterButtonLabels();
}

export async function updateFilterButtonLabels() {
  try {
    const bundles = await getFinancialStatementsHistory({ everyNTurns: 3 });

    if (bundles.length === 0) {
      return;
    }

    const sorted = [...bundles].sort((a, b) => b.atTurn - a.atTurn);
    const last3 = sorted.slice(0, 3).sort((a, b) => a.atTurn - b.atTurn);

    const filterButtons = document.querySelectorAll('.budget-filter-btn');
    for (let i = 0; i < 3; i++) {
      const btn = filterButtons[i];
      if (btn && !btn.dataset.period.includes('all')) {
        if (i < last3.length) {
          const turn = last3[i].atTurn;
          btn.textContent = `${turn} jours`;
          btn.dataset.period = turn.toString();
          btn.style.display = 'block';
          btn.disabled = false;
          btn.style.opacity = '1';
        } else {
          btn.style.display = 'block';
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.textContent = `${3 + i} jours`;
        }
      }
    }
  } catch (error) {
    console.warn('Error updating filter button labels:', error);
  }
}

export async function loadBudgetStates(period = '3', showLoading = true) {
  const budgetStatesList = document.getElementById('budget-states-list');
  const summaryContent = document.getElementById('summary-content');

  if (!budgetStatesList || !summaryContent) {
    console.warn('Budget states display elements not found');
    return;
  }

  if (showLoading) {
    budgetStatesList.innerHTML = `
            <div class="budget-state-loading">
                <p>Chargement du compte de résultat...</p>
            </div>
        `;
  }

  try {
    let bundles;

    if (period === 'all') {
      bundles = await getFinancialStatementsHistory({ everyNTurns: null });
    } else {
      const turnNumber = parseInt(period, 10);
      if (!Number.isNaN(turnNumber)) {
        bundles = await getFinancialStatementsHistory({ filterTurn: turnNumber });
      } else {
        bundles = await getFinancialStatementsHistory({ everyNTurns: 3 });
      }
    }

    if (bundles.length === 0) {
      budgetStatesList.innerHTML = `
                <div class="budget-state-loading">
                    <p>Aucun compte de résultat disponible</p>
                    <small>Les états sont dérivés du journal (checkpoints tous les 3 tours)</small>
                </div>
            `;
      summaryContent.innerHTML = '<p>Aucune donnée disponible</p>';
      return;
    }

    renderFinancialStatementsBundles(bundles, budgetStatesList);

    const fiscalYearStatement = await getIncomeStatement();
    renderBudgetSummary(bundles, summaryContent, fiscalYearStatement);
  } catch (error) {
    console.error('Error loading financial statements:', error);
    budgetStatesList.innerHTML = `
            <div class="budget-state-loading">
                <p>Erreur lors du chargement</p>
                <small>${error.message}</small>
            </div>
        `;
  }
}

export async function refreshBudgetStatesModal() {
  const activeFilterBtn = document.querySelector('.budget-filter-btn.active');
  const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : '3';
  await loadBudgetStates(currentPeriod, true);
  await updateFilterButtonLabels();
}

if (typeof window !== 'undefined') {
  registerAppFunction('refreshBudgetStatesModal', refreshBudgetStatesModal);
}
