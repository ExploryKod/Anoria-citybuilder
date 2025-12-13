/**
 * BudgetStatesManager - Gère l'affichage et la gestion des états budgétaires
 */
import { getHealthStatusText } from './RealtimeBudgetManager.js';

/**
 * Initialise le popup des états budgétaires
 */
export function initBudgetStatesPopup() {
    const budgetStatesBtn = document.getElementById('budget-states-btn');
    const budgetStatesPanel = document.getElementById('budget-states-panel');
    const budgetStatesCloseBtn = document.querySelector('.budget-states-close-btn');
    const budgetStatesList = document.getElementById('budget-states-list');
    const summaryContent = document.getElementById('summary-content');
    const filterButtons = document.querySelectorAll('.budget-filter-btn');

    if (!budgetStatesBtn || !budgetStatesPanel || !budgetStatesCloseBtn) {
        console.warn('Budget states popup elements not found');
        return;
    }

    // Toggle popup on budget states button click
    budgetStatesBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (e.target === budgetStatesBtn || budgetStatesBtn.contains(e.target)) {
            budgetStatesPanel.classList.toggle('active');
            budgetStatesBtn.classList.toggle('active');
            
            if (budgetStatesPanel.classList.contains('active')) {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('budget-states-panel');
                }
                // Load budget states first
                await loadBudgetStates('3', true);
                // Update labels after loading data
                await updateFilterButtonLabels();
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('budget-states-panel');
                }
            }
        }
    });

    // Close popup on close button click
    budgetStatesCloseBtn.addEventListener('click', () => {
        budgetStatesPanel.classList.remove('active');
        budgetStatesBtn.classList.remove('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('budget-states-panel');
        }
    });

    // Close popup when clicking outside
    budgetStatesPanel.addEventListener('click', (e) => {
        if (e.target === budgetStatesPanel) {
            budgetStatesPanel.classList.remove('active');
            budgetStatesBtn.classList.remove('active');
        }
    });

    // Filter button event listeners
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Load budget states with filter first (no loading state to avoid flash)
            const period = btn.dataset.period;
            await loadBudgetStates(period, false);
            
            // Update labels after loading data to avoid hiding buttons prematurely
            await updateFilterButtonLabels();
        });
    });

    // Update filter button labels dynamically
    updateFilterButtonLabels();
}

/**
 * Met à jour les labels des boutons de filtre avec les tours réels
 */
export async function updateFilterButtonLabels() {
    try {
        if (!window.budgetManager) {
            console.warn('BudgetManager not available for updating filter labels');
            return;
        }

        // Get all budget states from the store
        const allStates = await window.budgetManager.getBudgetStates();
        
        if (allStates.length === 0) {
            return;
        }

        // Sort by turn descending to get the most recent first
        const sortedStates = allStates.sort((a, b) => b.turn - a.turn);
        
        // Take the last 3 states (most recent)
        const last3States = sortedStates.slice(0, 3);
        
        // Sort by turn ascending for display order
        last3States.sort((a, b) => a.turn - b.turn);

        // Update the first 3 filter buttons (skip "Tous")
        const filterButtons = document.querySelectorAll('.budget-filter-btn');
        for (let i = 0; i < 3; i++) {
            const btn = filterButtons[i];
            if (btn && !btn.dataset.period.includes('all')) {
                if (i < last3States.length) {
                    // Show the actual turn from budget state
                    const turn = last3States[i].turn;
                    btn.textContent = `${turn} jours`;
                    btn.dataset.period = turn.toString();
                    btn.style.display = 'block';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                } else {
                    // Keep button visible but disabled if no state available
                    btn.style.display = 'block';
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.textContent = `${3 + i} jours`; // Fallback text
                }
            }
        }

    } catch (error) {
        console.warn('Error updating filter button labels:', error);
    }
}

/**
 * Charge les états budgétaires selon la période
 */
export async function loadBudgetStates(period = '3', showLoading = true) {
    const budgetStatesList = document.getElementById('budget-states-list');
    const summaryContent = document.getElementById('summary-content');
    
    if (!budgetStatesList || !summaryContent) {
        console.warn('Budget states display elements not found');
        return;
    }

    // Only show loading state if explicitly requested (first load)
    if (showLoading) {
        budgetStatesList.innerHTML = `
            <div class="budget-state-loading">
                <p>Chargement des états de budget...</p>
            </div>
        `;
    }

    try {
        if (!window.budgetManager) {
            throw new Error('BudgetManager not available');
        }

        let budgetStates = [];
        
        if (period === 'all') {
            budgetStates = await window.budgetManager.getBudgetStates();
        } else {
            const turnNumber = parseInt(period);
            if (!isNaN(turnNumber)) {
                // Pour les périodes dynamiques : afficher l'état du tour spécifique
                const allStates = await window.budgetManager.getBudgetStates();
                budgetStates = allStates.filter(state => state.turn === turnNumber);
            } else {
                // Fallback pour autres valeurs
                budgetStates = await window.budgetManager.getBudgetStatesEveryNTurns(3);
            }
        }

        if (budgetStates.length === 0) {
            budgetStatesList.innerHTML = `
                <div class="budget-state-loading">
                    <p>Aucun état de budget disponible</p>
                    <small>Les états sont collectés tous les 3 tours</small>
                </div>
            `;
            summaryContent.innerHTML = '<p>Aucune donnée disponible</p>';
            return;
        }

        // Filter out invalid states (missing required fields)
        const validStates = budgetStates.filter(state => 
            state && 
            typeof state.funds === 'number' && 
            typeof state.income === 'number' && 
            typeof state.expenses === 'number'
        );

        if (validStates.length === 0) {
            budgetStatesList.innerHTML = `
                <div class="budget-state-loading">
                    <p>Aucun état de budget valide disponible</p>
                    <small>Les données peuvent être corrompues</small>
                </div>
            `;
            summaryContent.innerHTML = '<p>Aucune donnée valide disponible</p>';
            return;
        }

        // Display budget states
        displayBudgetStates(validStates, budgetStatesList);
        
        // Display summary
        displayBudgetSummary(validStates, summaryContent);

    } catch (error) {
        console.error('Error loading budget states:', error);
        budgetStatesList.innerHTML = `
            <div class="budget-state-loading">
                <p>Erreur lors du chargement des états</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

/**
 * Affiche les états budgétaires dans le conteneur
 */
function displayBudgetStates(states, container) {
    container.innerHTML = states.map(state => {
        // Safely get values with fallbacks (using same keys as budget_current)
        const funds = state.funds || 0;
        const income = state.income || 0;
        const expenses = state.expenses || 0;
        const netFlow = state.netFlow || 0;
        const dailyIncome = state.dailyIncome || 0;
        const dailyExpenses = state.dailyExpenses || 0;
        const population = state.population || 0;
        const healthStatus = state.financialHealth?.status || 'healthy';
        const date = state.date ? new Date(state.date).toLocaleDateString('fr-FR') : 'N/A';
        
        return `
        <div class="budget-state-item">
            <div class="budget-state-header">
                <div class="budget-state-turn">Tour ${state.turn || 'N/A'}</div>
                <div class="budget-state-date">${date}</div>
            </div>
            
            <!-- Compte de Résultat -->
            <div class="budget-income-statement">
                <div class="statement-section">
                    <h4 class="statement-title">PRODUITS</h4>
                    <div class="statement-line">
                        <span class="statement-label">Impôt Citoyen (${population} hab.)</span>
                        <span class="statement-value positive">${(state.totalTaxes || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    ${state.taxBreakdown ? `
                    <div class="statement-subdetail" style="padding-left: 20px; margin: 8px 0;">
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons bleues</span>
                            <span class="statement-value">${(state.taxBreakdown['House-Blue'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons rouges</span>
                            <span class="statement-value">${(state.taxBreakdown['House-Red'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons violettes</span>
                            <span class="statement-value">${(state.taxBreakdown['House-Purple'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                    </div>
                    ` : ''}
                    <div class="statement-line">
                        <span class="statement-label">Autres revenus</span>
                        <span class="statement-value positive">${((income || 0) - (state.totalTaxes || 0)).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-line total-line">
                        <span class="statement-label">TOTAL PRODUITS</span>
                        <span class="statement-value total positive">${income.toLocaleString('fr-FR')}€</span>
                    </div>
                </div>
                
                <div class="statement-section">
                    <h4 class="statement-title">CHARGES</h4>
                    <div class="statement-line">
                        <span class="statement-label">Maintenance bâtiments</span>
                        <span class="statement-value negative">-${(state.totalBuildingMaintenance || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    ${state.maintenanceBreakdown ? `
                    <div class="statement-subdetail" style="padding-left: 20px; margin: 8px 0;">
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Habitations</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.houses || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Fermes</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.farms || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Marchés</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.markets || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Routes</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.roads || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Infrastructure</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.infrastructure || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Industrie</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.industry || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                    </div>
                    ` : ''}
                    <div class="statement-line">
                        <span class="statement-label">Intérêts dettes</span>
                        <span class="statement-value negative">-${(state.totalLoanInterestExpenses || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-subnote">
                        <small>Intérêts des prêts bancaires et commerciaux contractés</small>
                    </div>
                    <div class="statement-line">
                        <span class="statement-label">Remboursements prêts</span>
                        <span class="statement-value negative">-${(state.totalLoanRepayments || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-subnote">
                        <small>Remboursement du capital des prêts (principal)</small>
                    </div>
                    <div class="statement-line">
                        <span class="statement-label">Autres charges</span>
                        <span class="statement-value negative">-${Math.max(0, (expenses || 0) - (state.totalBuildingMaintenance || 0) - (state.totalLoanInterestExpenses || 0) - (state.totalLoanRepayments || 0)).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-subnote">
                        <small>Autres dépenses non catégorisées (salaires, services, etc.)</small>
                    </div>
                    <div class="statement-line total-line">
                        <span class="statement-label">TOTAL CHARGES</span>
                        <span class="statement-value total negative">-${expenses.toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-note">
                        <small>Vérification: Maintenance (${state.totalBuildingMaintenance || 0}€) + Intérêts (${state.totalLoanInterestExpenses || 0}€) + Remboursements (${state.totalLoanRepayments || 0}€) + Autres (${Math.max(0, (expenses || 0) - (state.totalBuildingMaintenance || 0) - (state.totalLoanInterestExpenses || 0) - (state.totalLoanRepayments || 0))}€) = ${(state.totalBuildingMaintenance || 0) + (state.totalLoanInterestExpenses || 0) + (state.totalLoanRepayments || 0) + Math.max(0, (expenses || 0) - (state.totalBuildingMaintenance || 0) - (state.totalLoanInterestExpenses || 0) - (state.totalLoanRepayments || 0))}€</small>
                    </div>
                </div>
                
                <div class="statement-section result-section">
                    <div class="statement-line result-line">
                        <span class="statement-label">RÉSULTAT NET</span>
                        <span class="statement-value result ${netFlow >= 0 ? 'positive' : 'negative'}">
                            ${netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString('fr-FR')}€
                        </span>
                    </div>
                    <div class="statement-note">
                        <small>Ce résultat doit correspondre au "Résultat de l'exercice" du bilan</small>
                    </div>
                </div>
            </div>
            
            <!-- Informations complémentaires -->
            <div class="budget-state-info">
                <div class="info-item">
                    <span class="info-label">Trésorerie</span>
                    <span class="info-value">${funds.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Population</span>
                    <span class="info-value">${population} habitants</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Santé financière</span>
                    <span class="info-value" style="color: ${getHealthStatusColor(healthStatus)}">
                        ${getHealthStatusText(healthStatus)}
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label"></span>
                    <span class="info-value ${(state.loanDebt || 0) > 0 ? 'negative' : ''}">${(state.loanDebt || 0).toLocaleString('fr-FR')}€</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Affiche le résumé des états budgétaires
 */
function displayBudgetSummary(states, container) {
    if (states.length === 0) {
        container.innerHTML = '<p>Aucune donnée disponible</p>';
        return;
    }

    const firstState = states[0];
    const lastState = states[states.length - 1];
    
    // Safely calculate totals with fallbacks (using same keys as budget_current)
    const totalIncome = states.reduce((sum, state) => sum + (state.income || 0), 0);
    const totalExpenses = states.reduce((sum, state) => sum + (state.expenses || 0), 0);
    const averageFunds = states.reduce((sum, state) => sum + (state.funds || 0), 0) / states.length;
    const populationGrowth = (lastState.population || 0) - (firstState.population || 0);
    
    // Calculate loan-related totals
    const totalLoanInterest = states.reduce((sum, state) => sum + (state.totalLoanInterest || 0), 0);
    const totalLoanRepayments = states.reduce((sum, state) => sum + (state.totalLoanRepayments || 0), 0);
    const currentLoanDebt = lastState.loanDebt || 0;
    
    const buildingGrowth = calculateBuildingGrowth(firstState.buildingCounts || {}, lastState.buildingCounts || {});

    container.innerHTML = `
        <div class="budget-income-statement">
            <div class="statement-section">
                <h4 class="statement-title">RÉSUMÉ PÉRIODE (Tours ${firstState.turn || 'N/A'} - ${lastState.turn || 'N/A'})</h4>
                <div class="statement-line">
                    <span class="statement-label">Revenus totaux</span>
                    <span class="statement-value positive">${totalIncome.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Dépenses totales</span>
                    <span class="statement-value negative">-${totalExpenses.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line total-line">
                    <span class="statement-label">Résultat net</span>
                    <span class="statement-value total ${(totalIncome - totalExpenses) >= 0 ? 'positive' : 'negative'}">
                        ${(totalIncome - totalExpenses) >= 0 ? '+' : ''}${(totalIncome - totalExpenses).toLocaleString('fr-FR')}€
                    </span>
                </div>
            </div>
            
            <div class="statement-section">
                <h4 class="statement-title">INDICATEURS</h4>
                <div class="statement-line">
                    <span class="statement-label">Trésorerie moyenne</span>
                    <span class="statement-value">${averageFunds.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Croissance population</span>
                    <span class="statement-value ${populationGrowth >= 0 ? 'positive' : 'negative'}">
                        ${populationGrowth >= 0 ? '+' : ''}${populationGrowth} habitants
                    </span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Nouveaux bâtiments</span>
                    <span class="statement-value">
                        ${Object.entries(buildingGrowth)
                            .filter(([type, growth]) => growth > 0)
                            .map(([type, growth]) => `${type}: +${growth}`)
                            .join(', ') || 'Aucun'}
                    </span>
                </div>
            </div>
            
            <div class="statement-section">
                <h4 class="statement-title">DETTES</h4>
                <div class="statement-line">
                    <span class="statement-label">Intérêts payés</span>
                    <span class="statement-value negative">-${totalLoanInterest.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Remboursements</span>
                    <span class="statement-value negative">-${totalLoanRepayments.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Dette actuelle</span>
                    <span class="statement-value ${currentLoanDebt > 0 ? 'negative' : ''}">${currentLoanDebt.toLocaleString('fr-FR')}€</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Calcule la croissance des bâtiments entre deux états
 */
function calculateBuildingGrowth(startBuildings, endBuildings) {
    const growth = {};
    const buildingTypes = ['houses', 'farms', 'markets', 'roads'];
    
    // Ensure we have valid objects
    const start = startBuildings || {};
    const end = endBuildings || {};
    
    for (const type of buildingTypes) {
        const startValue = start[type] || 0;
        const endValue = end[type] || 0;
        growth[type] = endValue - startValue;
    }
    
    return growth;
}

/**
 * Retourne la couleur associée au statut de santé financière
 */
function getHealthStatusColor(status) {
    const colorMap = {
        'healthy': '#4ade80',
        'warning': '#ffa726',
        'critical': '#ff6b6b',
        'excellent': '#4ade80',
        'deficit': '#ff9800'
    };
    return colorMap[status] || '#4ade80';
}

/**
 * Rafraîchit le modal des états budgétaires
 */
export async function refreshBudgetStatesModal() {
    // Get current active filter button
    const activeFilterBtn = document.querySelector('.budget-filter-btn.active');
    const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : '3';
    
    // Reload budget states with current period
    await loadBudgetStates(currentPeriod, true);
    
    // Update filter button labels
    await updateFilterButtonLabels();
}

// Make refresh function globally accessible
if (typeof window !== 'undefined') {
    window.refreshBudgetStatesModal = refreshBudgetStatesModal;
}

