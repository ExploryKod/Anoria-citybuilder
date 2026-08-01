/**
 * PretsPanel — popup prêts bancaires (DOM + événements + commandes UI).
 * Rendu : PretsPresenter.js
 */

import {
  getPopupManager,
  invokeUpdateBudgetDisplay,
  registerAppFunction,
} from '../../../../composition/sessionShell.js';
import { bindSessionRuntime, requireSessionAccountingApi } from '../../../../composition/sessionRuntime.js';
import {
  updateLoansElement,
  renderHealthImpact,
  renderLoanRates,
  renderActiveLoansHtml,
  renderActiveLoansErrorHtml,
} from './PretsPresenter.js';

/**
 * Initialise le popup des prêts
 */
export function initLoansPopup() {
  const loansBtn = document.getElementById('loans-btn');
  const loansPanel = document.getElementById('loans-panel');
  const loansCloseBtn = document.querySelector('.loans-panel-close-btn');
  const loanSelectBtns = document.querySelectorAll('.loan-select-btn');
  const loanCancelBtn = document.getElementById('loan-cancel-btn');
  const loanContractBtn = document.getElementById('loan-contract-btn');
  const loanAmountInput = document.getElementById('loan-amount-input');
  const loanDurationInput = document.getElementById('loan-duration-input');

  if (!loansBtn || !loansPanel || !loansCloseBtn) {
    console.warn('Loans popup elements not found');
    return;
  }

  loansBtn.addEventListener('click', () => {
    loansPanel.classList.add('active');

    if (getPopupManager()) {
      getPopupManager().forceOpenPopup('loans-panel');
    }

    updateLoansDisplay();
  });

  loansCloseBtn.addEventListener('click', () => {
    loansPanel.classList.remove('active');

    if (getPopupManager()) {
      getPopupManager().forceClosePopup('loans-panel');
    }
  });

  loansPanel.addEventListener('click', (e) => {
    if (e.target === loansPanel) {
      loansPanel.classList.remove('active');

      if (getPopupManager()) {
        getPopupManager().forceClosePopup('loans-panel');
      }
    }
  });

  loanSelectBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const loanType = btn.dataset.loanType;
      showLoanForm(loanType);
    });
  });

  if (loanCancelBtn) {
    loanCancelBtn.addEventListener('click', () => {
      hideLoanForm();
    });
  }

  if (loanContractBtn) {
    loanContractBtn.addEventListener('click', () => {
      contractLoan();
    });
  }

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
    const currentBudget = await requireSessionAccountingApi().getTreasurySnapshot();
    const financialHealth = await requireSessionAccountingApi().getFinancialHealth();

    updateLoansElement('loans-date', `Tour ${currentBudget.turn || 0}`);

    const healthIndicatorEl = document.getElementById('loans-health-indicator');
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

    renderHealthImpact(financialHealth);
    renderLoanRates(requireSessionAccountingApi().computeLoanRatesByType(financialHealth.status));
    loadActiveLoans();
  } catch (error) {
    console.error('Error updating loans display:', error);
  }
}

/**
 * Affiche le formulaire de prêt
 */
function showLoanForm(loanType) {
  const loanFormSection = document.getElementById('loan-form-section');
  if (loanFormSection) {
    loanFormSection.style.display = 'block';

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

    loanFormSection.dataset.loanType = loanType;
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
  const loanType = loanFormSection.dataset.loanType || 'bank';

  requireSessionAccountingApi().getFinancialHealth().then((health) => {
    const interestRate = requireSessionAccountingApi().computeLoanRate({
      loanType,
      financialHealthStatus: health.status,
    });
    const interest = requireSessionAccountingApi().computeLoanInterestAmount(amount, interestRate);
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
    alert("Le montant doit être d'au moins 100€");
    return;
  }

  try {
    const financialHealth = await requireSessionAccountingApi().getFinancialHealth();
    const interestRate = requireSessionAccountingApi().computeLoanRate({
      loanType,
      financialHealthStatus: financialHealth.status,
    });

    const interest = requireSessionAccountingApi().computeLoanInterestAmount(amount, interestRate);
    const total = amount + interest;

    const loan = {
      id: `loan_${Date.now()}`,
      type: loanType,
      amount,
      total,
      interest,
      interestRate,
      duration,
      remainingTurns: duration,
      contractedAt: new Date().toISOString(),
    };

    await requireSessionAccountingApi().recordLoanCapital(amount, `Prêt ${loanType} contracté (${duration} tours)`, loan);

    await invokeUpdateBudgetDisplay();

    alert(
      `Prêt ${loanType} de ${amount}€ contracté ! Total à rembourser : ${total}€ sur ${duration} tours.`
    );

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
    const activeLoans = await requireSessionAccountingApi().getActiveLoans();
    activeLoansList.innerHTML = renderActiveLoansHtml(activeLoans);
  } catch (error) {
    console.error('Error loading active loans:', error);
    activeLoansList.innerHTML = renderActiveLoansErrorHtml();
  }
}

/**
 * Traite les paiements de prêts à chaque tour.
 * En cas d'insolvabilité : écritures informatives au journal (sans débit trésorerie).
 */
export async function processLoanPayments() {
  try {
    const activeLoans = await requireSessionAccountingApi().getActiveLoans();
    if (activeLoans.length === 0) return;

    for (const loan of activeLoans) {
      const monthlyPayment = Math.round(loan.total / loan.duration);
      const interestPayment = Math.round(
        (loan.amount * (loan.interestRate / 100)) / loan.duration
      );
      const principalPayment = Math.max(0, monthlyPayment - interestPayment);

      const budget = await requireSessionAccountingApi().getTreasurySnapshot();

      if (budget.funds >= monthlyPayment) {
        await requireSessionAccountingApi().recordLoanInterest(
          interestPayment,
          `Intérêts prêt ${loan.type} (${loan.id})`,
          loan.id
        );

        await requireSessionAccountingApi().recordLoanRepayment(
          principalPayment,
          `Remboursement prêt ${loan.type} (${loan.id})`,
          loan.id
        );
        continue;
      }

      if (budget.funds >= interestPayment && interestPayment > 0) {
        await requireSessionAccountingApi().recordLoanInterest(
          interestPayment,
          `Intérêts prêt ${loan.type} (${loan.id})`,
          loan.id
        );

        if (principalPayment > 0) {
          await requireSessionAccountingApi().recordInfoLoanInstallment({
            interestAmount: 0,
            principalAmount: principalPayment,
            loanId: loan.id,
            loanType: loan.type,
          });
        }

        await requireSessionAccountingApi().advanceLoanInstallmentWithoutPayment(loan.id);
        console.warn(
          `[Loans] Échéance partielle — intérêts payés, capital impayé (${principalPayment}€) pour ${loan.id}`
        );
        continue;
      }

      await requireSessionAccountingApi().recordInfoLoanInstallment({
        interestAmount: interestPayment,
        principalAmount: principalPayment,
        loanId: loan.id,
        loanType: loan.type,
      });

      await requireSessionAccountingApi().advanceLoanInstallmentWithoutPayment(loan.id);
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
  bindSessionRuntime({ processLoanPayments });
  // Legacy mirror for UI / tests still reading the registry
  registerAppFunction('processLoanPayments', processLoanPayments);
}
