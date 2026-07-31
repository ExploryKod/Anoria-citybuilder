/**
 * RealtimeBudgetManager - Gère l'affichage et la mise à jour du budget en temps réel
 */
import {
  getTreasurySnapshot,
  getFinancialHealth,
  getIncomeBreakdown,
  getExpenseBreakdown,
  getActiveLoans,
} from "../../acl/accountingGame.js";
import gameStore from "../../stores/GameStore.js";
import { getCityTotalPopulation } from "../../acl/housing.js";

/**
 * Initialise le popup de budget en temps réel
 */
export function initRealtimeBudgetPopup() {
    const realtimeBudgetBtn = document.getElementById('realtime-budget-btn');
    const realtimeBudgetPanel = document.getElementById('realtime-budget-panel');
    const realtimeBudgetCloseBtn = document.querySelector('.realtime-budget-close-btn');
    const realtimeFundsEl = document.getElementById('realtime-funds');

    if (!realtimeBudgetBtn || !realtimeBudgetPanel || !realtimeBudgetCloseBtn || !realtimeFundsEl) {
        console.warn('Real-time budget popup elements not found');
        return;
    }

    // Toggle popup on budget box click
    realtimeBudgetBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        e.preventDefault(); // Prevent default behavior
        
        // Only toggle if clicking directly on the budget box or its children
        if (e.target === realtimeBudgetBtn || realtimeBudgetBtn.contains(e.target)) {
            realtimeBudgetPanel.classList.toggle('active');
            realtimeBudgetBtn.classList.toggle('active'); // Add/remove active class on button
            
            if (realtimeBudgetPanel.classList.contains('active')) {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('realtime-budget-panel');
                }
                updateRealtimeBudget();
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('realtime-budget-panel');
                }
            }
        }
    });

    // Close popup on close button click
    realtimeBudgetCloseBtn.addEventListener('click', () => {
        realtimeBudgetPanel.classList.remove('active');
        realtimeBudgetBtn.classList.remove('active'); // Remove active class from button
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('realtime-budget-panel');
        }
    });

    // Close popup when clicking outside
    realtimeBudgetPanel.addEventListener('click', (e) => {
        if (e.target === realtimeBudgetPanel) {
            realtimeBudgetPanel.classList.remove('active');
            realtimeBudgetBtn.classList.remove('active'); // Remove active class from button
            // No need to manage pointer events since budget panel doesn't interfere with 3D scene
        }
    });

    // Update real-time budget every second when popup is open
    setInterval(() => {
        if (realtimeBudgetPanel.classList.contains('active')) {
            updateRealtimeBudget();
        }
    }, 1000);

    // Note: Removed automatic closing when other modals open
    // The budget panel now stays open when building modals are active
}

/**
 * Met à jour l'affichage du budget en temps réel
 */
export async function updateRealtimeBudget() {
    const realtimeFundsEl = document.getElementById('realtime-funds');
    const realtimeIncomeEl = document.getElementById('realtime-income');
    const realtimeExpensesEl = document.getElementById('realtime-expenses');
    const realtimeNetflowEl = document.getElementById('realtime-netflow');
    const realtimeTurnEl = document.getElementById('realtime-turn');
    const realtimePopulationEl = document.getElementById('realtime-population');
    const realtimeHealthStatusEl = document.getElementById('realtime-health-status');
    const realtimeHealthMessageEl = document.getElementById('realtime-health-message');
    const realtimeTaxesEl = document.getElementById('realtime-taxes');
    const realtimeOtherIncomeEl = document.getElementById('realtime-other-income');
    const realtimeBuildingMaintenanceEl = document.getElementById('realtime-building-maintenance');
    const realtimeLoanInterestEl = document.getElementById('realtime-loan-interest');
    const realtimeInvestmentsEl = document.getElementById('realtime-investments');
    // Starvation alerts removed

    if (!realtimeFundsEl) {
        console.warn('Realtime budget elements not found');
        return;
    }

    try {
        
        const budgetData = await getTreasurySnapshot();
        const financialHealth = await getFinancialHealth();
        const incomeBreakdown = await getIncomeBreakdown();
        const expenseBreakdown = await getExpenseBreakdown();
            
            // Primary source: Housing BC (residential pop sum)
            // Fallback: gameStore (game table) for backwards compatibility
            let population = 0;
            let populationError = false;
            try {
                population = await getCityTotalPopulation();
            } catch (error) {
                populationError = true;
                console.error('[RealtimeBudgetManager] Error fetching population from Housing BC:', error);
                if (window.gameStore && typeof window.gameStore.getLatestGameItemByField === 'function') {
                    console.warn('[RealtimeBudgetManager] ⚠️ FALLING BACK to gameStore (may be stale)');
                    const gamePop = await window.gameStore.getLatestGameItemByField('population');
                    population = gamePop !== null && gamePop !== undefined ? gamePop : 0;
                } else {
                    console.error('[RealtimeBudgetManager] ❌ Housing BC and gameStore unavailable! Population set to 0');
                    population = 0;
                }
            }
            
            // Mettre à jour les fonds principaux
            const funds = budgetData.funds || 0;
            realtimeFundsEl.textContent = `${funds.toLocaleString('fr-FR')}€`;
            
            // Add visual feedback for low funds
            if (funds < 10) {
                realtimeFundsEl.style.color = '#ff6b6b';
                realtimeFundsEl.style.animation = 'pulse 1s infinite';
            } else if (funds < 50) {
                realtimeFundsEl.style.color = '#ffa726';
                realtimeFundsEl.style.animation = 'pulse 2s infinite';
            } else {
                realtimeFundsEl.style.color = 'var(--cta)';
                realtimeFundsEl.style.animation = 'pulse 2s infinite';
            }
            
            // Mettre à jour les détails financiers
            if (realtimeIncomeEl) {
                const income = budgetData.income || 0;
                realtimeIncomeEl.textContent = `${income.toLocaleString('fr-FR')}€`;
            }
            if (realtimeExpensesEl) {
                const expenses = budgetData.expenses || 0;
                realtimeExpensesEl.textContent = `${expenses.toLocaleString('fr-FR')}€`;
            }
            if (realtimeNetflowEl) {
                const netFlow = (budgetData.income || 0) - (budgetData.expenses || 0);
                realtimeNetflowEl.textContent = `${netFlow.toLocaleString('fr-FR')}€`;
                // Colorer le flux net selon s'il est positif ou négatif
                if (netFlow > 0) {
                    realtimeNetflowEl.style.color = 'var(--success)';
                } else if (netFlow < 0) {
                    realtimeNetflowEl.style.color = 'var(--danger)';
                } else {
                    realtimeNetflowEl.style.color = 'var(--cta)';
                }
            }
            // Mettre à jour les informations générales
            if (realtimeTurnEl) {
                const turnSpan = realtimeTurnEl.querySelector('span');
                if (turnSpan) {
                    turnSpan.textContent = budgetData.turn || 0;
                } else {
                    realtimeTurnEl.textContent = budgetData.turn || 0;
                }
            }
            if (realtimePopulationEl) {
                const populationSpan = realtimePopulationEl.querySelector('span');
                if (populationSpan) {
                    populationSpan.textContent = population.toString();
                    
                    // Style différent selon l'état
                    if (populationError) {
                        populationSpan.style.color = '#ff6b6b'; // Rouge pour erreur
                        realtimePopulationEl.title = 'Erreur lors du chargement de la population';
                    } else {
                        populationSpan.style.color = '#fff'; // Blanc pour valeur normale
                        realtimePopulationEl.title = `Population actuelle (${population} habitants)`;
                    }
                } else {
                    realtimePopulationEl.textContent = population.toString();
                }
            }
            
            // Mettre à jour la santé financière
            if (realtimeHealthStatusEl && realtimeHealthMessageEl) {
                realtimeHealthStatusEl.textContent = getHealthStatusText(financialHealth.status);
                realtimeHealthMessageEl.textContent = financialHealth.message;
                
                // Appliquer la classe CSS appropriée
                realtimeHealthStatusEl.className = 'realtime-health-status ' + financialHealth.status;
            }
            
            // Mettre à jour les détails des revenus
            if (realtimeTaxesEl) {
                const taxes = incomeBreakdown.taxes || 0;
                realtimeTaxesEl.textContent = `${taxes.toLocaleString('fr-FR')}€`;
            }
            if (realtimeOtherIncomeEl) {
                const otherIncome = incomeBreakdown.otherIncome || 0;
                realtimeOtherIncomeEl.textContent = `${otherIncome.toLocaleString('fr-FR')}€`;
            }
            
            // Mettre à jour les détails des dépenses
            if (realtimeBuildingMaintenanceEl) {
                const buildingMaintenance = expenseBreakdown.buildingMaintenance || 0;
                realtimeBuildingMaintenanceEl.textContent = `${buildingMaintenance.toLocaleString('fr-FR')}€`;
            }
            if (realtimeLoanInterestEl) {
                const loanInterest = budgetData.totalLoanInterestExpenses || 0;
                realtimeLoanInterestEl.textContent = `${loanInterest.toLocaleString('fr-FR')}€`;
            }
            if (realtimeInvestmentsEl) {
                const investments = expenseBreakdown.investments || 0;
                realtimeInvestmentsEl.textContent = `${investments.toLocaleString('fr-FR')}€`;
            }
            
            // Mettre à jour le détail du calcul des intérêts des dettes
            updateLoanInterestDetail(budgetData);
            
            // Starvation alerts removed
    } catch (error) {
        console.error('Error updating real-time budget:', error);
        realtimeFundsEl.textContent = 'Erreur';
        realtimeFundsEl.style.color = '#ff6b6b';
        if (realtimeHealthStatusEl) realtimeHealthStatusEl.textContent = 'Erreur';
        if (realtimeHealthMessageEl) realtimeHealthMessageEl.textContent = 'Impossible de charger les données';
        
        // Show population span even on error
        if (realtimePopulationEl) {
            const populationSpan = realtimePopulationEl.querySelector('span');
            if (populationSpan) {
                populationSpan.textContent = 'Erreur';
                populationSpan.style.color = '#ff6b6b';
                realtimePopulationEl.title = 'Erreur lors du chargement de la population';
            }
        }
    }
}

/**
 * Retourne le texte du statut de santé financière
 */
export function getHealthStatusText(status) {
    const statusMap = {
        'healthy': 'Sain',
        'warning': 'Attention',
        'critical': 'Critique',
        'excellent': 'Excellent',
        'deficit': 'Déficitaire'
    };
    return statusMap[status] || 'Inconnu';
}

/**
 * Met à jour le détail du calcul des intérêts des prêts
 */
async function updateLoanInterestDetail(budgetData) {
    const detailContainer = document.getElementById('realtime-loan-interest-detail');
    if (!detailContainer) return;
    
    try {
        const activeLoans = await getActiveLoans();
        
        if (activeLoans.length === 0) {
            detailContainer.innerHTML = `
                <div class="no-loans-message">
                    <span class="no-loans-icon">📭</span>
                    <span class="no-loans-text">Aucun prêt actif</span>
                </div>
            `;
            return;
        }
        
        let totalInterest = 0;
        const loanCalculations = activeLoans.map(loan => {
            const monthlyInterest = Math.round(loan.amount * (loan.interestRate / 100) / loan.duration);
            totalInterest += monthlyInterest;
            
            return `
                <div class="loan-interest-calculation">
                    <div class="loan-interest-calculation-header">
                        <div class="loan-interest-calculation-title">
                            ${loan.type === 'bank' ? '🏛️ Prêt Bancaire' : '🏪 Prêt Commercial'} (${loan.id.slice(-6)})
                        </div>
                        <div class="loan-interest-calculation-amount">${monthlyInterest.toLocaleString('fr-FR')}€/tour</div>
                    </div>
                    <div class="loan-interest-calculation-details">
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Montant emprunté:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.amount.toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Taux d'intérêt:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.interestRate}%</span>
                        </div>
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Durée:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.duration} tours</span>
                        </div>
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Calcul:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.amount.toLocaleString('fr-FR')}€ × ${loan.interestRate}% ÷ ${loan.duration} = ${monthlyInterest.toLocaleString('fr-FR')}€/tour</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        detailContainer.innerHTML = `
            ${loanCalculations}
            <div class="loan-interest-calculation" style="border-left-color: var(--success); background: rgba(0, 255, 0, 0.05);">
                <div class="loan-interest-calculation-header">
                    <div class="loan-interest-calculation-title">💰 Total Intérêts par Tour</div>
                    <div class="loan-interest-calculation-amount" style="color: var(--success);">${totalInterest.toLocaleString('fr-FR')}€</div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error updating loan interest detail:', error);
        detailContainer.innerHTML = `
            <div class="no-loans-message">
                <span class="no-loans-icon">❌</span>
                <span class="no-loans-text">Erreur lors du chargement</span>
            </div>
        `;
    }
}

