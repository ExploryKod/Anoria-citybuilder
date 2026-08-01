/**
 * CompteDeResultatPanel — popup compte de résultat (DOM + événements).
 * Rendu : CompteDeResultatPresenter.js
 */

import {
  renderFinancialStatementsBundles,
  renderBudgetSummary,
} from './CompteDeResultatPresenter.js';

/**
 * @type {{
 *   accounting: object,
 *   popupManager?: object | null,
 * } | null}
 */
let deps = null;

/**
 * @param {{
 *   accounting: object,
 *   popupManager?: object | null,
 * }} panelDeps
 */
export function initBudgetStatesPopup(panelDeps) {
  deps = panelDeps;
  const { popupManager } = deps;

  const compteDeResultatBtn = document.getElementById('compte-de-resultat-btn');
  const compteDeResultatPanel = document.getElementById('compte-de-resultat-panel');
  const compteDeResultatCloseBtn = document.querySelector('.compte-de-resultat-close-btn');
  const filterButtons = document.querySelectorAll('.budget-filter-btn');

  if (!compteDeResultatBtn || !compteDeResultatPanel || !compteDeResultatCloseBtn) {
    console.warn('Budget states popup elements not found');
    return;
  }

  compteDeResultatBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.target === compteDeResultatBtn || compteDeResultatBtn.contains(e.target)) {
      compteDeResultatPanel.classList.toggle('active');
      compteDeResultatBtn.classList.toggle('active');

      if (compteDeResultatPanel.classList.contains('active')) {
        popupManager?.forceOpenPopup('compte-de-resultat-panel');
        await loadBudgetStates('3', true);
        await updateFilterButtonLabels();
      } else {
        popupManager?.forceClosePopup('compte-de-resultat-panel');
      }
    }
  });

  compteDeResultatCloseBtn.addEventListener('click', () => {
    compteDeResultatPanel.classList.remove('active');
    compteDeResultatBtn.classList.remove('active');
    popupManager?.forceClosePopup('compte-de-resultat-panel');
  });

  compteDeResultatPanel.addEventListener('click', (e) => {
    if (e.target === compteDeResultatPanel) {
      compteDeResultatPanel.classList.remove('active');
      compteDeResultatBtn.classList.remove('active');
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
  if (!deps?.accounting) return;

  try {
    const bundles = await deps.accounting.getFinancialStatementsHistory({ everyNTurns: 3 });

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
  if (!deps?.accounting) {
    console.warn('[CompteDeResultatPanel] deps not initialized');
    return;
  }

  const { accounting } = deps;
  const compteDeResultatList = document.getElementById('compte-de-resultat-list');
  const summaryContent = document.getElementById('summary-content');

  if (!compteDeResultatList || !summaryContent) {
    console.warn('Budget states display elements not found');
    return;
  }

  if (showLoading) {
    compteDeResultatList.innerHTML = `
            <div class="budget-state-loading">
                <p>Chargement du compte de résultat...</p>
            </div>
        `;
  }

  try {
    let bundles;

    if (period === 'all') {
      bundles = await accounting.getFinancialStatementsHistory({ everyNTurns: null });
    } else {
      const turnNumber = parseInt(period, 10);
      if (!Number.isNaN(turnNumber)) {
        bundles = await accounting.getFinancialStatementsHistory({ filterTurn: turnNumber });
      } else {
        bundles = await accounting.getFinancialStatementsHistory({ everyNTurns: 3 });
      }
    }

    if (bundles.length === 0) {
      compteDeResultatList.innerHTML = `
                <div class="budget-state-loading">
                    <p>Aucun compte de résultat disponible</p>
                    <small>Les états sont dérivés du journal (checkpoints tous les 3 tours)</small>
                </div>
            `;
      summaryContent.innerHTML = '<p>Aucune donnée disponible</p>';
      return;
    }

    renderFinancialStatementsBundles(bundles, compteDeResultatList);

    const fiscalYearStatement = await accounting.getIncomeStatement();
    renderBudgetSummary(bundles, summaryContent, fiscalYearStatement);
  } catch (error) {
    console.error('Error loading financial statements:', error);
    compteDeResultatList.innerHTML = `
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
