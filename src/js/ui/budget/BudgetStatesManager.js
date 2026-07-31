/**
 * BudgetStatesManager — CR + bilan par tour via Accounting BC (journal-primary).
 *
 * `budget_turn_*` reste en Dexie comme cache d'enrichissement (population, breakdowns).
 * Source primaire CR/bilan : journal via getFinancialStatementsHistory().
 */

import { getHealthStatusText } from './RealtimeBudgetManager.js';
import {
  getFinancialStatementsHistory,
  getIncomeStatement,
} from '../../acl/accounting.js';

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

    budgetStatesBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (e.target === budgetStatesBtn || budgetStatesBtn.contains(e.target)) {
            budgetStatesPanel.classList.toggle('active');
            budgetStatesBtn.classList.toggle('active');
            
            if (budgetStatesPanel.classList.contains('active')) {
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('budget-states-panel');
                }
                await loadBudgetStates('3', true);
                await updateFilterButtonLabels();
            } else if (window.popupManager) {
                window.popupManager.forceClosePopup('budget-states-panel');
            }
        }
    });

    budgetStatesCloseBtn.addEventListener('click', () => {
        budgetStatesPanel.classList.remove('active');
        budgetStatesBtn.classList.remove('active');
        if (window.popupManager) {
            window.popupManager.forceClosePopup('budget-states-panel');
        }
    });

    budgetStatesPanel.addEventListener('click', (e) => {
        if (e.target === budgetStatesPanel) {
            budgetStatesPanel.classList.remove('active');
            budgetStatesBtn.classList.remove('active');
        }
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.dataset.period;
            await loadBudgetStates(period, false);
            await updateFilterButtonLabels();
        });
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

        displayFinancialStatementsBundles(bundles, budgetStatesList);

        const fiscalYearStatement = await getIncomeStatement();
        displayBudgetSummary(bundles, summaryContent, fiscalYearStatement);
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

function productAmount(bundle, label) {
    return bundle.incomeStatement.products.find((p) => p.label === label)?.amount ?? 0;
}

function chargeAmount(bundle, label) {
    return bundle.incomeStatement.charges.find((c) => c.label === label)?.amount ?? 0;
}

function displayFinancialStatementsBundles(bundles, container) {
    container.innerHTML = bundles.map((bundle) => {
        const { incomeStatement, balanceSheet, enrichment } = bundle;
        const income = incomeStatement.totalProducts;
        const expenses = incomeStatement.totalCharges;
        const netFlow = incomeStatement.netResult;
        const funds = balanceSheet.assets.cash;
        const population = enrichment?.population ?? 0;
        const healthStatus = enrichment?.financialHealth?.status ?? 'healthy';
        const date = enrichment?.date
            ? new Date(enrichment.date).toLocaleDateString('fr-FR')
            : 'N/A';

        const totalTaxes = productAmount(bundle, 'Impôt citoyen');
        const totalBuildingMaintenance = chargeAmount(bundle, 'Maintenance');
        const totalLoanInterestExpenses = chargeAmount(bundle, 'Intérêts de prêts');
        const totalLoanRepayments = chargeAmount(bundle, 'Remboursements prêts');
        const taxBreakdown = enrichment?.taxBreakdown;
        const maintenanceBreakdown = enrichment?.maintenanceBreakdown;
        const loanDebt = enrichment?.loanDebt ?? 0;

        return `
        <div class="budget-state-item">
            <div class="budget-state-header">
                <div class="budget-state-turn">Tour ${bundle.atTurn}</div>
                <div class="budget-state-date">${date}</div>
                <div class="budget-state-source"><small>Source: ${bundle.source === 'journal+cache' ? 'journal + cache budget' : 'journal'}</small></div>
            </div>
            
            <div class="budget-income-statement">
                <div class="statement-section">
                    <h4 class="statement-title">PRODUITS (cumul journal)</h4>
                    <div class="statement-line">
                        <span class="statement-label">Impôt Citoyen (${population} hab.)</span>
                        <span class="statement-value positive">${totalTaxes.toLocaleString('fr-FR')}€</span>
                    </div>
                    ${taxBreakdown ? `
                    <div class="statement-subdetail" style="padding-left: 20px; margin: 8px 0;">
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons bleues</span>
                            <span class="statement-value">${(taxBreakdown['House-Blue'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons rouges</span>
                            <span class="statement-value">${(taxBreakdown['House-Red'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons violettes</span>
                            <span class="statement-value">${(taxBreakdown['House-Purple'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                    </div>
                    ` : ''}
                    ${incomeStatement.products.filter((p) => p.label !== 'Impôt citoyen').map((p) => `
                    <div class="statement-line">
                        <span class="statement-label">${p.label}</span>
                        <span class="statement-value positive">${p.amount.toLocaleString('fr-FR')}€</span>
                    </div>
                    `).join('')}
                    <div class="statement-line total-line">
                        <span class="statement-label">TOTAL PRODUITS</span>
                        <span class="statement-value total positive">${income.toLocaleString('fr-FR')}€</span>
                    </div>
                </div>
                
                <div class="statement-section">
                    <h4 class="statement-title">CHARGES (cumul journal)</h4>
                    ${incomeStatement.charges.map((c) => `
                    <div class="statement-line">
                        <span class="statement-label">${c.label}</span>
                        <span class="statement-value negative">-${c.amount.toLocaleString('fr-FR')}€</span>
                    </div>
                    `).join('')}
                    <div class="statement-line total-line">
                        <span class="statement-label">TOTAL CHARGES</span>
                        <span class="statement-value total negative">-${expenses.toLocaleString('fr-FR')}€</span>
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
                        <small>Lien bilan : résultat de l'exercice = ${balanceSheet.liabilities.netResult.toLocaleString('fr-FR')}€</small>
                    </div>
                </div>
            </div>
            
            <div class="budget-state-info">
                <div class="info-item">
                    <span class="info-label">Trésorerie (bilan)</span>
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
                    <span class="info-label">Dette prêts (cache)</span>
                    <span class="info-value ${loanDebt > 0 ? 'negative' : ''}">${loanDebt.toLocaleString('fr-FR')}€</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function displayBudgetSummary(bundles, container, fiscalYearStatement = null) {
    if (bundles.length === 0 && !fiscalYearStatement) {
        container.innerHTML = '<p>Aucune donnée disponible</p>';
        return;
    }

    const fiscalSection = fiscalYearStatement
        ? `
            <div class="statement-section">
                <h4 class="statement-title">CR EXERCICE (année ${fiscalYearStatement.fiscalYear} ap JC — journal)</h4>
                <div class="statement-line">
                    <span class="statement-label">Total produits</span>
                    <span class="statement-value positive">${fiscalYearStatement.totalProducts.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Total charges</span>
                    <span class="statement-value negative">-${fiscalYearStatement.totalCharges.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line result-line">
                    <span class="statement-label">Résultat net</span>
                    <span class="statement-value result ${fiscalYearStatement.netResult >= 0 ? 'positive' : 'negative'}">
                        ${fiscalYearStatement.netResult >= 0 ? '+' : ''}${fiscalYearStatement.netResult.toLocaleString('fr-FR')}€
                    </span>
                </div>
            </div>
        `
        : '';

    if (bundles.length === 0) {
        container.innerHTML = fiscalSection;
        return;
    }

    const first = bundles[0];
    const last = bundles[bundles.length - 1];
    const avgCash =
        bundles.reduce((sum, b) => sum + b.balanceSheet.assets.cash, 0) / bundles.length;
    const populationGrowth =
        (last.enrichment?.population ?? 0) - (first.enrichment?.population ?? 0);

    container.innerHTML = `
        <div class="budget-income-statement">
            ${fiscalSection}
            <div class="statement-section">
                <h4 class="statement-title">RÉSUMÉ CHECKPOINTS (Tours ${first.atTurn} - ${last.atTurn})</h4>
                <div class="statement-line">
                    <span class="statement-label">Trésorerie moyenne (bilan)</span>
                    <span class="statement-value">${Math.round(avgCash).toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Croissance population</span>
                    <span class="statement-value ${populationGrowth >= 0 ? 'positive' : 'negative'}">
                        ${populationGrowth >= 0 ? '+' : ''}${populationGrowth} habitants
                    </span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Résultat net (dernier checkpoint)</span>
                    <span class="statement-value ${last.incomeStatement.netResult >= 0 ? 'positive' : 'negative'}">
                        ${last.incomeStatement.netResult >= 0 ? '+' : ''}${last.incomeStatement.netResult.toLocaleString('fr-FR')}€
                    </span>
                </div>
            </div>
        </div>
    `;
}

function getHealthStatusColor(status) {
    const colorMap = {
        healthy: '#4ade80',
        warning: '#ffa726',
        critical: '#ff6b6b',
        excellent: '#4ade80',
        deficit: '#ff9800',
    };
    return colorMap[status] || '#4ade80';
}

export async function refreshBudgetStatesModal() {
    const activeFilterBtn = document.querySelector('.budget-filter-btn.active');
    const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : '3';
    await loadBudgetStates(currentPeriod, true);
    await updateFilterButtonLabels();
}

if (typeof window !== 'undefined') {
    window.refreshBudgetStatesModal = refreshBudgetStatesModal;
}
