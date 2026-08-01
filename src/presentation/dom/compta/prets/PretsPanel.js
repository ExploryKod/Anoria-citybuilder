/**
 * PretsPanel — popup prêts bancaires (DOM + événements + commandes UI).
 * Rendu : PretsPresenter.js
 */

import {
  updateLoansElement,
  renderHealthImpact,
  renderLoanRates,
  renderActiveLoansHtml,
  renderActiveLoansErrorHtml,
} from './PretsPresenter.js';

/**
 * @type {{
 *   accounting: object,
 *   popupManager?: object | null,
 *   updateBudgetDisplay?: () => Promise<void> | void,
 * } | null}
 */
let deps = null;

/**
 * @param {{
 *   accounting: object,
 *   popupManager?: object | null,
 *   updateBudgetDisplay?: () => Promise<void> | void,
 * }} panelDeps
 */
export function initLoansPopup(panelDeps) {
  deps = panelDeps;
  if (typeof document === 'undefined') {
    return;
  }

  const { popupManager } = deps;

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
    popupManager?.forceOpenPopup('loans-panel');
    updateLoansDisplay();
  });

  loansCloseBtn.addEventListener('click', () => {
    loansPanel.classList.remove('active');
    popupManager?.forceClosePopup('loans-panel');
  });

  loansPanel.addEventListener('click', (e) => {
    if (e.target === loansPanel) {
      loansPanel.classList.remove('active');
      popupManager?.forceClosePopup('loans-panel');
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

export async function updateLoansDisplay() {
  if (!deps?.accounting) return;
  const { accounting } = deps;

  try {
    const currentBudget = await accounting.getTreasurySnapshot();
    const financialHealth = await accounting.getFinancialHealth();

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
    renderLoanRates(accounting.computeLoanRatesByType(financialHealth.status));
    loadActiveLoans();
  } catch (error) {
    console.error('Error updating loans display:', error);
  }
}

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

function hideLoanForm() {
  const loanFormSection = document.getElementById('loan-form-section');
  if (loanFormSection) {
    loanFormSection.style.display = 'none';
  }
}

function updateLoanSummary() {
  if (!deps?.accounting) return;
  const { accounting } = deps;

  const loanAmountInput = document.getElementById('loan-amount-input');
  const loanDurationInput = document.getElementById('loan-duration-input');
  const loanFormSection = document.getElementById('loan-form-section');

  if (!loanAmountInput || !loanDurationInput || !loanFormSection) return;

  const amount = parseInt(loanAmountInput.value) || 0;
  const loanType = loanFormSection.dataset.loanType || 'bank';

  accounting.getFinancialHealth().then((health) => {
    const interestRate = accounting.computeLoanRate({
      loanType,
      financialHealthStatus: health.status,
    });
    const interest = accounting.computeLoanInterestAmount(amount, interestRate);
    const total = amount + interest;

    updateLoansElement('loan-principal-display', `${amount}€`);
    updateLoansElement('loan-rate-display', `${interestRate}%`);
    updateLoansElement('loan-interest-display', `${interest}€`);
    updateLoansElement('loan-total-display', `${total}€`);
  });
}

export async function contractLoan() {
  if (!deps?.accounting) return;
  const { accounting, updateBudgetDisplay } = deps;

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
    const financialHealth = await accounting.getFinancialHealth();
    const interestRate = accounting.computeLoanRate({
      loanType,
      financialHealthStatus: financialHealth.status,
    });

    const interest = accounting.computeLoanInterestAmount(amount, interestRate);
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

    await accounting.recordLoanCapital(amount, `Prêt ${loanType} contracté (${duration} tours)`, loan);

    await updateBudgetDisplay?.();

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

export async function loadActiveLoans() {
  if (!deps?.accounting) return;
  const activeLoansList = document.getElementById('active-loans-list');
  if (!activeLoansList) return;

  try {
    const activeLoans = await deps.accounting.getActiveLoans();
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
  if (!deps?.accounting) return;
  const { accounting, updateBudgetDisplay } = deps;

  try {
    const activeLoans = await accounting.getActiveLoans();
    if (activeLoans.length === 0) return;

    for (const loan of activeLoans) {
      const monthlyPayment = Math.round(loan.total / loan.duration);
      const interestPayment = Math.round(
        (loan.amount * (loan.interestRate / 100)) / loan.duration
      );
      const principalPayment = Math.max(0, monthlyPayment - interestPayment);

      const budget = await accounting.getTreasurySnapshot();

      if (budget.funds >= monthlyPayment) {
        await accounting.recordLoanInterest(
          interestPayment,
          `Intérêts prêt ${loan.type} (${loan.id})`,
          loan.id
        );

        await accounting.recordLoanRepayment(
          principalPayment,
          `Remboursement prêt ${loan.type} (${loan.id})`,
          loan.id
        );
        continue;
      }

      if (budget.funds >= interestPayment && interestPayment > 0) {
        await accounting.recordLoanInterest(
          interestPayment,
          `Intérêts prêt ${loan.type} (${loan.id})`,
          loan.id
        );

        if (principalPayment > 0) {
          await accounting.recordInfoLoanInstallment({
            interestAmount: 0,
            principalAmount: principalPayment,
            loanId: loan.id,
            loanType: loan.type,
          });
        }

        await accounting.advanceLoanInstallmentWithoutPayment(loan.id);
        console.warn(
          `[Loans] Échéance partielle — intérêts payés, capital impayé (${principalPayment}€) pour ${loan.id}`
        );
        continue;
      }

      await accounting.recordInfoLoanInstallment({
        interestAmount: interestPayment,
        principalAmount: principalPayment,
        loanId: loan.id,
        loanType: loan.type,
      });

      await accounting.advanceLoanInstallmentWithoutPayment(loan.id);
      console.warn(
        `[Loans] Défaut de paiement — échéance journalisée (info) pour ${loan.id}`
      );
    }

    await updateBudgetDisplay?.();
  } catch (error) {
    console.error('Error processing loan payments:', error);
  }
}

/**
 * @param {{
 *   bindProcessLoanPayments?: (fn: typeof processLoanPayments) => void,
 *   registerHandler?: (name: string, fn: Function) => void,
 * }} [hooks]
 */
export function initLoanPaymentSystem(hooks = {}) {
  hooks.bindProcessLoanPayments?.(processLoanPayments);
  hooks.registerHandler?.('processLoanPayments', processLoanPayments);
}
