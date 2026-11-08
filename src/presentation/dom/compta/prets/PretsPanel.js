/**
 * PretsPanel — popup prêts bancaires (DOM + événements + commandes UI).
 * Rendu : PretsPresenter.js
 */

import {
  updateLoansElement,
  renderHealthImpact,
  renderLoanRates,
  renderExternalLenders,
  renderActiveLoansHtml,
  renderActiveLoansErrorHtml,
} from './PretsPresenter.js';
import { createModalFocusSession } from '../../shell/modalFocus.js';
import { formatEuro, formatYearlyRate } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { buildingName } from '../../shell/CatalogVocabulary.js';
import { noticeModal } from '../../shell/ConfirmModal.js';

/**
 * @type {{
 *   accounting: object,
 *   popupManager?: object | null,
 *   updateTreasuryDisplay: () => Promise<void>,
 * } | null}
 */
let deps = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let loansFocusSession = null;

/**
 * @param {{
 *   accounting: object,
 *   popupManager?: object | null,
 *   updateTreasuryDisplay: () => Promise<void>,
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
    openLoans();
  });

  function openLoans() {
    loansPanel.classList.add('active');
    popupManager?.forceOpenPopup('loans-panel');
    updateLoansDisplay();
    loansFocusSession?.release({ restoreFocus: false });
    loansFocusSession = createModalFocusSession({
      panel: loansPanel,
      onEscape: closeLoans,
      initialFocus: '.loans-panel-close-btn',
    });
  }

  function closeLoans() {
    loansFocusSession?.release();
    loansFocusSession = null;
    loansPanel.classList.remove('active');
    popupManager?.forceClosePopup('loans-panel');
  }

  loansCloseBtn.addEventListener('click', () => {
    closeLoans();
  });

  loansPanel.addEventListener('click', (e) => {
    if (e.target === loansPanel) {
      closeLoans();
    }
  });

  loanSelectBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const loanType = btn.dataset.loanType;
      showLoanForm(loanType);
    });
  });
  // The partner cities that lend are listed when the panel opens: their buttons are born then, so the click is heard on their container.
  document.getElementById('external-loans')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.loan-select-btn');
    if (btn) showLoanForm('external', { cityId: btn.dataset.lenderCity, cityName: btn.dataset.lenderName, maxAmount: Number(btn.dataset.maxAmount) });
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

/** The partner cities that lend the city now (the ones it trades with and the catalog names), each with the rate it would ask. */
async function showExternalLenders() {
  const { accounting, trade } = deps;
  const partnerIds = trade ? (await trade.getAllRelations()).filter((relation) => relation.status === 'active').map((relation) => relation.cityId) : [];
  const lenders = accounting.listExternalLenders({ partnerIds });
  const withRates = await Promise.all(
    lenders.map(async (lender) => ({
      ...lender,
      yearlyRate: (await accounting.getLoanTerms({ loanType: 'external', amount: 100, durationTurns: 20, lenderCityId: lender.cityId })).yearlyRate,
    }))
  );
  renderExternalLenders(withRates);
}

/**
 * A loan that cannot be asked has its button greyed and says why, under it, so the player learns the cause before trying (contractLoan still checks, for what depends on the amount).
 * The bank's loans need a bank that stands, is staffed and is not frozen by the supervisor; every loan needs room under the debt ceiling.
 */
async function refreshLoanAvailability() {
  const { accounting } = deps;
  const borrowing = await accounting.getCityBorrowing();
  const bankId = await accounting.findBankBuildingId();
  const solvency = bankId ? await accounting.getBankSolvency() : null;
  let bankRefusal = null;
  if (!bankId) bankRefusal = `Aucune ${buildingName('Bank').toLowerCase()} construite.`;
  else if (!(await accounting.isBankStaffed(bankId))) bankRefusal = `La ${buildingName('Bank').toLowerCase()} est à l'arrêt : personne n'y travaille.`;
  else if (solvency.capitalStatus === 'frozen' || solvency.insolvent) bankRefusal = 'Le superviseur a gelé les prêts de la banque (fonds propres trop faibles).';
  const ceilingRefusal = borrowing.headroom < 100
    ? `Plafond d'endettement atteint : la ville doit ${formatEuro(borrowing.debt)} pour un plafond de ${formatEuro(borrowing.ceiling)}.`
    : null;

  document.querySelectorAll('#loans-panel .loan-select-btn').forEach((btn) => {
    const external = btn.dataset.loanType === 'external';
    const refusal = (external ? null : bankRefusal) ?? ceilingRefusal;
    const option = btn.closest('.loan-option');
    option?.querySelector('.loan-unavailable')?.remove();
    btn.disabled = refusal !== null;
    if (refusal) {
      const note = document.createElement('div');
      note.className = 'loan-unavailable';
      note.textContent = refusal;
      btn.insertAdjacentElement('afterend', note);
    }
  });
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
    // The rates follow the policy rate in force (the central bank's, or the catalog's while none works) and the city's health.
    renderLoanRates((await accounting.getPolicyRate()).loanRates);
    await showExternalLenders();
    await refreshLoanAvailability();
    loadActiveLoans();
  } catch (error) {
    console.error('Error updating loans display:', error);
  }
}

function showLoanForm(loanType, lender = null) {
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
    } else if (loanType === 'external') {
      if (!lender) throw new Error('[loans] an external loan is contracted with a lender city');
      if (loanAmountInput) {
        loanAmountInput.min = '100';
        loanAmountInput.max = String(lender.maxAmount);
        loanAmountInput.value = String(Math.min(1000, lender.maxAmount));
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
    if (lender) {
      loanFormSection.dataset.lenderCity = lender.cityId;
      loanFormSection.dataset.lenderName = lender.cityName;
      loanFormSection.dataset.maxAmount = String(lender.maxAmount);
    } else {
      delete loanFormSection.dataset.lenderCity;
      delete loanFormSection.dataset.lenderName;
      delete loanFormSection.dataset.maxAmount;
    }
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
  const durationTurns = parseInt(loanDurationInput.value);
  // The form is opened by showLoanForm, which sets the type: none here is a defect, never a bank loan by default.
  const loanType = loanFormSection.dataset.loanType;
  if (!loanType) throw new Error('[loans] the loan form has no loan type: it must be opened by showLoanForm');

  accounting.getLoanTerms({ loanType, amount, durationTurns, lenderCityId: loanFormSection.dataset.lenderCity ?? null }).then(({ yearlyRate, interest, total }) => {
    updateLoansElement('loan-principal-display', formatEuro(amount));
    updateLoansElement('loan-rate-display', formatYearlyRate(yearlyRate));
    updateLoansElement('loan-interest-display', formatEuro(interest));
    updateLoansElement('loan-total-display', formatEuro(total));
  });
}

export async function contractLoan() {
  if (!deps?.accounting) return;
  const { accounting, updateTreasuryDisplay } = deps;

  const loanAmountInput = document.getElementById('loan-amount-input');
  const loanDurationInput = document.getElementById('loan-duration-input');
  const loanFormSection = document.getElementById('loan-form-section');

  if (!loanAmountInput || !loanDurationInput || !loanFormSection) return;

  const amount = parseInt(loanAmountInput.value);
  const duration = parseInt(loanDurationInput.value);
  const loanType = loanFormSection.dataset.loanType;

  const refuse = (message) => noticeModal({ title: 'Prêt refusé', message });

  if (!amount || amount < 100) {
    await refuse("Le montant doit être d'au moins 100€.");
    return;
  }

  try {
    // No bank, no real lender: a loan is now a bank's own money, not a city-level abstraction (see
    // RecordLoanCapitalIncome.js). The bank must also actually hold the amount it is about to lend out: what it lacks, it borrows
    // from the central bank when one works (BankRefinancing.js); otherwise the loan is refused.
    // A loan from a partner city is foreign money: no bank lends it, and no bank's reserves are asked for it.
    const external = loanType === 'external';
    const lenderCityId = external ? loanFormSection.dataset.lenderCity : null;
    if (external && amount > Number(loanFormSection.dataset.maxAmount)) {
      await refuse(`${loanFormSection.dataset.lenderName} ne prête pas plus de ${formatEuro(Number(loanFormSection.dataset.maxAmount))} en un prêt.`);
      return;
    }
    const lenderBuildingId = external ? null : await accounting.findBankBuildingId();
    if (!external && !lenderBuildingId) {
      await refuse(`Aucune ${buildingName('Bank').toLowerCase()} construite : impossible de contracter un prêt.`);
      return;
    }
    // A bank with no one at the counter lends nothing: the staff must be in post before the loan is asked.
    if (!external && !(await accounting.isBankStaffed(lenderBuildingId))) {
      await refuse(`La ${buildingName('Bank').toLowerCase()} est à l'arrêt : personne n'y travaille. Logez des travailleurs qualifiés pour la faire fonctionner, puis redemandez le prêt.`);
      return;
    }
    const { turn } = await accounting.getTreasurySnapshot();
    // Lenders judge the State by its debt against its income: past the ceiling, no one lends (before the bank is asked for reserves).
    const borrowing = await accounting.getCityBorrowing();
    if (amount > borrowing.headroom) {
      await refuse(`Les prêteurs refusent : la ville doit déjà ${formatEuro(borrowing.debt)}, et son plafond d'endettement est de ${formatEuro(borrowing.ceiling)} (${formatEuro(borrowing.headroom)} encore possibles). Il dépend de la production de la ville sur l'année.`);
      return;
    }
    // A loan to the State takes the bank's reserves (the money goes to the Treasury's account at the central bank), and must leave it the reserve the ratio asks.
    const { covered, reason } = external ? { covered: true } : await accounting.coverBankShortfall({ turn, bankId: lenderBuildingId, reservesOut: amount, depositsAdded: 0 });
    if (!covered) {
      const { bankPosition } = await accounting.getPolicyRate();
      if (reason === 'capital') {
        await refuse(`Le superviseur a gelé les prêts de la banque : ses fonds propres sont trop faibles par rapport à ses prêts. La ville peut la recapitaliser depuis la section « ${buildingName(accounting.getCentralBankType())} » du panneau d'administration.`);
        return;
      }
      if (reason === 'collateral') {
        await refuse(`La banque n'a plus de garanties à remettre à ${buildingName(accounting.getCentralBankType())} : elle ne peut pas être refinancée de plus (${formatEuro(bankPosition.loans)} de prêts, ${formatEuro(bankPosition.owedMain + bankPosition.owedMarginal)} déjà dus, ${formatEuro(bankPosition.collateralCapacity)} encore possibles).`);
        return;
      }
      await refuse(`La banque n'a pas les réserves pour ce prêt tout en gardant la réserve obligatoire (${formatEuro(bankPosition.reserves)} de réserves, ${formatEuro(bankPosition.requiredReserve)} à garder), et ne peut pas être refinancée sans ${buildingName(accounting.getCentralBankType())} en activité dans cet État.`);
      return;
    }

    // The terms the panel showed: the yearly rate in force and the interest for the loan's duration. The rate is stamped on the contract and never re-read.
    const { yearlyRate, interest, total } = await accounting.getLoanTerms({ loanType, amount, durationTurns: duration, lenderCityId });

    const loan = {
      id: `loan_${Date.now()}`,
      type: loanType,
      amount,
      total,
      interest,
      interestRate: yearlyRate,
      duration,
      remainingTurns: duration,
      lenderBuildingId,
      // The city that lends it, for a loan from a partner city (null for a bank's): its name is stamped so the list of loans says who lent.
      ...(external ? { lenderCityId, lenderCityName: loanFormSection.dataset.lenderName } : {}),
    };

    await accounting.recordLoanCapital(amount, `Prêt ${loanType} contracté (${duration} tours)`, loan, lenderBuildingId);

    await updateTreasuryDisplay();

    hideLoanForm();
    await loadActiveLoans();
    await refreshLoanAvailability();
    // The form closes and the list of loans comes into view, so the player sees the new loan without scrolling for it.
    document.getElementById('active-loans-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    await noticeModal({
      title: 'Prêt contracté',
      message: `${formatEuro(amount)} sont versés au Trésor. À rembourser : ${formatEuro(total)} sur ${duration} tours.`,
    });
  } catch (error) {
    console.error('Error contracting loan:', error);
    await noticeModal({ title: 'Le prêt a échoué', message: error.message });
  }
}

export async function loadActiveLoans() {
  if (!deps?.accounting) return;
  const activeLoansList = document.getElementById('active-loans-list');
  if (!activeLoansList) return;

  try {
    const activeLoans = await deps.accounting.getActiveLoans();
    activeLoansList.innerHTML = renderActiveLoansHtml(activeLoans, deps.accounting.loanInstallmentOf);
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
  const { accounting, updateTreasuryDisplay } = deps;

  try {
    const activeLoans = await accounting.getActiveLoans();
    if (activeLoans.length === 0) return;

    for (const loan of activeLoans) {
      const { payment: monthlyPayment, interest: interestPayment, principal: principalPayment } = accounting.loanInstallmentOf(loan);

      const budget = await accounting.getTreasurySnapshot();

      if (budget.funds >= monthlyPayment) {
        await accounting.recordLoanInterest(
          interestPayment,
          `Intérêts prêt ${loan.type} (${loan.id})`,
          loan.id,
          loan.lenderBuildingId
        );

        await accounting.recordLoanRepayment(
          principalPayment,
          `Remboursement prêt ${loan.type} (${loan.id})`,
          loan.id,
          loan.lenderBuildingId
        );
        continue;
      }

      if (budget.funds >= interestPayment && interestPayment > 0) {
        await accounting.recordLoanInterest(
          interestPayment,
          `Intérêts prêt ${loan.type} (${loan.id})`,
          loan.id,
          loan.lenderBuildingId
        );

        if (principalPayment > 0) {
          await accounting.recordInfoLoanInstallment({
            interestAmount: 0,
            principalAmount: principalPayment,
            loanId: loan.id,
            loanType: loan.type,
          });
        }

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

      console.warn(
        `[Loans] Défaut de paiement — échéance journalisée (info) pour ${loan.id}`
      );
    }

    await updateTreasuryDisplay();
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
