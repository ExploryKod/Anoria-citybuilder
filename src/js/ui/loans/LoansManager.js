/**
 * LoansManager - Gère le système de prêts (bancaires et commerciaux)
 */

import {
  getTreasurySnapshot,
  getFinancialHealth,
  getActiveLoans,
  recordLoanCapital,
  recordLoanInterest,
  recordLoanRepayment,
  recordInfoLoanInstallment,
  advanceLoanInstallmentWithoutPayment,
} from '../../acl/accountingGame.js';
import {
  getPopupManager,
  invokeUpdateBudgetDisplay,
  registerAppFunction,
} from '../../acl/appRuntime.js';
import {
  computeLoanRate,
  computeLoanRatesByType,
  computeLoanInterestAmount,
} from '../../acl/accountingLoans.js';

/**
 * Initialise le popup des prêts
 */
export function initLoansPopup() {
    const loansBtn = document.getElementById('loans-btn');
    const loansPanel = document.getElementById('loans-panel');
    const loansCloseBtn = document.querySelector('.loans-panel-close-btn');
    const loanSelectBtns = document.querySelectorAll('.loan-select-btn');
    const loanFormSection = document.getElementById('loan-form-section');
    const loanCancelBtn = document.getElementById('loan-cancel-btn');
    const loanContractBtn = document.getElementById('loan-contract-btn');
    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationInput = document.getElementById('loan-duration-input');

    if (!loansBtn || !loansPanel || !loansCloseBtn) {
        console.warn('Loans popup elements not found');
        return;
    }

    // Toggle popup on loans button click
    loansBtn.addEventListener('click', () => {
        loansPanel.classList.add('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (getPopupManager()) {
            getPopupManager().forceOpenPopup('loans-panel');
        }
        
        updateLoansDisplay();
    });

    // Close popup on close button click
    loansCloseBtn.addEventListener('click', () => {
        loansPanel.classList.remove('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (getPopupManager()) {
            getPopupManager().forceClosePopup('loans-panel');
        }
    });

    // Close popup when clicking outside
    loansPanel.addEventListener('click', (e) => {
        if (e.target === loansPanel) {
            loansPanel.classList.remove('active');
            
            // Utiliser PopupManager pour gérer les événements
            if (getPopupManager()) {
                getPopupManager().forceClosePopup('loans-panel');
            }
        }
    });

    // Loan selection buttons
    loanSelectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const loanType = btn.dataset.loanType;
            showLoanForm(loanType);
        });
    });

    // Cancel loan form
    if (loanCancelBtn) {
        loanCancelBtn.addEventListener('click', () => {
            hideLoanForm();
        });
    }

    // Contract loan
    if (loanContractBtn) {
        loanContractBtn.addEventListener('click', () => {
            contractLoan();
        });
    }

    // Update loan summary when inputs change
    if (loanAmountInput && loanDurationInput) {
        loanAmountInput.addEventListener('input', updateLoanSummary);
        loanDurationInput.addEventListener('change', updateLoanSummary);
    }
}

/**
 * Met à jour l'affichage des prêts
 */
export async function updateLoansDisplay() {
    try {
        // Get budget data
        const currentBudget = await getTreasurySnapshot();
        const financialHealth = await getFinancialHealth();
        
        // Update date
        updateLoansElement('loans-date', `Tour ${currentBudget.turn || 0}`);
        
        // Update health indicator
        const healthIndicatorEl = document.getElementById('loans-health-indicator');
        const healthStatusEl = healthIndicatorEl?.querySelector('.health-status');
        
        if (healthIndicatorEl && healthStatusEl) {
            healthStatusEl.textContent = financialHealth.message;
            healthIndicatorEl.classList.remove('warning', 'critical');
            
            if (financialHealth.status === 'critical') {
                healthIndicatorEl.classList.add('critical');
            } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
                healthIndicatorEl.classList.add('warning');
            }
        }
        
        // Update health impact section
        updateHealthImpact(financialHealth);
        
        // Update loan rates based on financial health
        updateLoanRates(financialHealth);
        
        // Load active loans
        loadActiveLoans();
        
    } catch (error) {
        console.error('Error updating loans display:', error);
    }
}

/**
 * Met à jour un élément du DOM pour les prêts
 */
function updateLoansElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Met à jour l'affichage de l'impact de la santé financière
 */
function updateHealthImpact(financialHealth) {
    const healthImpactEl = document.getElementById('health-impact');
    if (!healthImpactEl) return;
    
    let healthStatusClass = 'health-status-good';
    let healthIcon = '✅';
    let healthText = 'Finance saine - Taux préférentiels disponibles';
    
    if (financialHealth.status === 'critical') {
        healthStatusClass = 'health-status-critical';
        healthIcon = '⚠️';
        healthText = 'Finance critique - Taux élevés appliqués';
    } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
        healthStatusClass = 'health-status-warning';
        healthIcon = '⚠️';
        healthText = 'Finance fragile - Taux majorés';
    }
    
    healthImpactEl.innerHTML = `
        <div class="${healthStatusClass}">
            <span class="health-icon">${healthIcon}</span>
            <span class="health-text">${healthText}</span>
        </div>
    `;
}

/**
 * Met à jour les taux de prêt selon la santé financière
 */
function updateLoanRates(financialHealth) {
    const rates = computeLoanRatesByType(financialHealth.status);
    updateLoansElement('bank-rate', `Taux: ${rates.bank}%`);
    updateLoansElement('commercial-rate', `Taux: ${rates.commercial}%`);
}

/**
 * Affiche le formulaire de prêt
 */
function showLoanForm(loanType) {
    const loanFormSection = document.getElementById('loan-form-section');
    if (loanFormSection) {
        loanFormSection.style.display = 'block';
        
        // Set loan type specific values
        const loanAmountInput = document.getElementById('loan-amount-input');
        const loanDurationInput = document.getElementById('loan-duration-input');
        
        if (loanType === 'bank') {
            if (loanAmountInput) {
                loanAmountInput.min = '100';
                loanAmountInput.max = '1000';
                loanAmountInput.value = '500';
            }
            if (loanDurationInput) {
                loanDurationInput.innerHTML = `
                    <option value="10">10 tours</option>
                    <option value="15">15 tours</option>
                    <option value="20">20 tours</option>
                `;
            }
        } else if (loanType === 'commercial') {
            if (loanAmountInput) {
                loanAmountInput.min = '200';
                loanAmountInput.max = '2000';
                loanAmountInput.value = '1000';
            }
            if (loanDurationInput) {
                loanDurationInput.innerHTML = `
                    <option value="15">15 tours</option>
                    <option value="20">20 tours</option>
                    <option value="25">25 tours</option>
                    <option value="30">30 tours</option>
                `;
            }
        }
        
        // Store current loan type
        loanFormSection.dataset.loanType = loanType;
        
        // Update summary
        updateLoanSummary();
    }
}

/**
 * Cache le formulaire de prêt
 */
function hideLoanForm() {
    const loanFormSection = document.getElementById('loan-form-section');
    if (loanFormSection) {
        loanFormSection.style.display = 'none';
    }
}

/**
 * Met à jour le résumé du prêt
 */
function updateLoanSummary() {
    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationInput = document.getElementById('loan-duration-input');
    const loanFormSection = document.getElementById('loan-form-section');
    
    if (!loanAmountInput || !loanDurationInput || !loanFormSection) return;
    
    const amount = parseInt(loanAmountInput.value) || 0;
    const duration = parseInt(loanDurationInput.value) || 10;
    const loanType = loanFormSection.dataset.loanType || 'bank';
    
    getFinancialHealth().then((health) => {
        const interestRate = computeLoanRate({
            loanType,
            financialHealthStatus: health.status,
        });
        const interest = computeLoanInterestAmount(amount, interestRate);
        const total = amount + interest;

        updateLoansElement('loan-principal-display', `${amount}€`);
        updateLoansElement('loan-rate-display', `${interestRate}%`);
        updateLoansElement('loan-interest-display', `${interest}€`);
        updateLoansElement('loan-total-display', `${total}€`);
    });
}

/**
 * Contracte un prêt
 */
export async function contractLoan() {
    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationInput = document.getElementById('loan-duration-input');
    const loanFormSection = document.getElementById('loan-form-section');
    
    if (!loanAmountInput || !loanDurationInput || !loanFormSection) return;
    
    const amount = parseInt(loanAmountInput.value);
    const duration = parseInt(loanDurationInput.value);
    const loanType = loanFormSection.dataset.loanType;
    
    if (!amount || amount < 100) {
        alert('Le montant doit être d\'au moins 100€');
        return;
    }
    
    try {
        // Calculate final interest rate
        const financialHealth = await getFinancialHealth();
        const interestRate = computeLoanRate({
            loanType,
            financialHealthStatus: financialHealth.status,
        });
        
        const interest = computeLoanInterestAmount(amount, interestRate);
        const total = amount + interest;
        
        // Create loan object
        const loan = {
            id: `loan_${Date.now()}`,
            type: loanType,
            amount: amount,
            total: total,
            interest: interest,
            interestRate: interestRate,
            duration: duration,
            remainingTurns: duration,
            contractedAt: new Date().toISOString()
        };
        
        // Add loan to budget using proper accounting method
        await recordLoanCapital(amount, `Prêt ${loanType} contracté (${duration} tours)`, loan);
        
        await invokeUpdateBudgetDisplay();
        
        alert(`Prêt ${loanType} de ${amount}€ contracté ! Total à rembourser : ${total}€ sur ${duration} tours.`);
        
        // Reset form
        hideLoanForm();
        loadActiveLoans();
        
    } catch (error) {
        console.error('Error contracting loan:', error);
        alert('Erreur lors de la contraction du prêt');
    }
}

/**
 * Charge et affiche les prêts actifs
 */
export async function loadActiveLoans() {
    const activeLoansList = document.getElementById('active-loans-list');
    if (!activeLoansList) return;
    
    try {
        const activeLoans = await getActiveLoans();
        
        if (activeLoans.length === 0) {
            activeLoansList.innerHTML = `
                <div class="no-loans">
                    <span class="no-loans-icon">📭</span>
                    <span class="no-loans-text">Aucun prêt actif</span>
                </div>
            `;
            return;
        }
        
        activeLoansList.innerHTML = activeLoans.map(loan => {
            // Calculate amortization schedule
            const amortizationSchedule = generateAmortizationSchedule(loan);
            
            return `
                <div class="loan-item">
                    <div class="loan-item-header">
                        <div class="loan-type">${loan.type === 'bank' ? '🏛️ Bancaire' : '🏪 Commercial'}</div>
                        <div class="loan-amount">${loan.amount}€</div>
                        <div class="loan-progress">${loan.remainingTurns}/${loan.duration} tours</div>
                    </div>
                    <div class="loan-details">
                        <div>Taux: ${loan.interestRate}%</div>
                        <div>Total à rembourser: ${loan.total}€ (intérêts: ${loan.interest}€)</div>
                    </div>
                    
                    <!-- Amortization Schedule -->
                    <div class="amortization-schedule">
                        <h4>Tableau d'amortissement</h4>
                        <div class="schedule-summary">
                            <div class="summary-item">
                                <span class="label">Intérêts totaux restants:</span>
                                <span class="value">${amortizationSchedule.remainingInterest}€</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">Capital restant:</span>
                                <span class="value">${loan.amount}€</span>
                            </div>
                        </div>
                        
                        <div class="schedule-table">
                            <div class="schedule-header">
                                <div class="col-turn">Tour</div>
                                <div class="col-payment">Paiement</div>
                                <div class="col-interest">Intérêts</div>
                                <div class="col-principal">Capital</div>
                                <div class="col-balance">Solde</div>
                            </div>
                            ${amortizationSchedule.schedule.map((row, index) => `
                                <div class="schedule-row ${row.paid ? 'paid' : ''}">
                                    <div class="col-turn">${row.turn}</div>
                                    <div class="col-payment">${row.payment}€</div>
                                    <div class="col-interest">${row.interest}€</div>
                                    <div class="col-principal">${row.principal}€</div>
                                    <div class="col-balance">${row.balance}€</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading active loans:', error);
        activeLoansList.innerHTML = `
            <div class="no-loans">
                <span class="no-loans-icon">❌</span>
                <span class="no-loans-text">Erreur lors du chargement</span>
            </div>
        `;
    }
}

/**
 * Génère le tableau d'amortissement pour un prêt
 */
function generateAmortizationSchedule(loan) {
    const schedule = [];
    const monthlyPayment = Math.round(loan.total / loan.duration);
    const interestRate = loan.interestRate / 100;
    let remainingBalance = loan.amount;
    let totalInterestPaid = 0;
    let paidTurns = loan.duration - loan.remainingTurns;
    
    // Calculate total interest for the loan
    const totalInterest = loan.interest || Math.round(loan.amount * interestRate);
    
    for (let turn = 1; turn <= loan.duration; turn++) {
        const interestPayment = Math.round(remainingBalance * interestRate / loan.duration);
        const principalPayment = monthlyPayment - interestPayment;
        const isPaid = turn <= paidTurns;
        
        if (isPaid) {
            remainingBalance = Math.max(0, remainingBalance - principalPayment);
            totalInterestPaid += interestPayment;
        }
        
        schedule.push({
            turn: turn,
            payment: monthlyPayment,
            interest: interestPayment,
            principal: principalPayment,
            balance: remainingBalance,
            paid: isPaid
        });
    }
    
    const remainingInterest = Math.max(0, totalInterest - totalInterestPaid);
    
    return {
        schedule: schedule,
        remainingInterest: remainingInterest
    };
}

/**
 * Traite les paiements de prêts à chaque tour.
 * En cas d'insolvabilité : écritures informatives au journal (sans débit trésorerie).
 */
export async function processLoanPayments() {
    try {
        const activeLoans = await getActiveLoans();
        if (activeLoans.length === 0) return;

        for (const loan of activeLoans) {
            const monthlyPayment = Math.round(loan.total / loan.duration);
            const interestPayment = Math.round(
                (loan.amount * (loan.interestRate / 100)) / loan.duration
            );
            const principalPayment = Math.max(0, monthlyPayment - interestPayment);

            let budget = await getTreasurySnapshot();

            if (budget.funds >= monthlyPayment) {
                await recordLoanInterest(
                    interestPayment,
                    `Intérêts prêt ${loan.type} (${loan.id})`,
                    loan.id
                );

                await recordLoanRepayment(
                    principalPayment,
                    `Remboursement prêt ${loan.type} (${loan.id})`,
                    loan.id
                );
                continue;
            }

            if (budget.funds >= interestPayment && interestPayment > 0) {
                await recordLoanInterest(
                    interestPayment,
                    `Intérêts prêt ${loan.type} (${loan.id})`,
                    loan.id
                );

                if (principalPayment > 0) {
                    await recordInfoLoanInstallment({
                        interestAmount: 0,
                        principalAmount: principalPayment,
                        loanId: loan.id,
                        loanType: loan.type,
                    });
                }

                await advanceLoanInstallmentWithoutPayment(loan.id);
                console.warn(
                    `[Loans] Échéance partielle — intérêts payés, capital impayé (${principalPayment}€) pour ${loan.id}`
                );
                continue;
            }

            await recordInfoLoanInstallment({
                interestAmount: interestPayment,
                principalAmount: principalPayment,
                loanId: loan.id,
                loanType: loan.type,
            });

            await advanceLoanInstallmentWithoutPayment(loan.id);
            console.warn(
                `[Loans] Défaut de paiement — échéance journalisée (info) pour ${loan.id}`
            );
        }

        await invokeUpdateBudgetDisplay();
    } catch (error) {
        console.error('Error processing loan payments:', error);
    }
}

/**
 * Initialise le système de paiement des prêts
 */
export function initLoanPaymentSystem() {
    registerAppFunction('processLoanPayments', processLoanPayments);
}

