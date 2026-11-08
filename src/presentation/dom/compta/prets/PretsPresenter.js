/**
 * PretsPresenter — rendu DOM des prêts (données déjà chargées).
 */
import { formatYearlyRate } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { html } from '../../shell/safeHtml.js';

/**
 * @param {string} elementId
 * @param {string} value
 */
export function updateLoansElement(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}

/**
 * @param {{ status: string }} financialHealth
 */
export function renderHealthImpact(financialHealth) {
  const healthImpactEl = document.getElementById('health-impact');
  if (!healthImpactEl) return;

  let healthStatusClass = 'health-status-good';
  let healthText = 'Finance saine : taux préférentiels disponibles';

  if (financialHealth.status === 'critical') {
    healthStatusClass = 'health-status-critical';
    healthText = 'Finance critique : taux élevés appliqués';
  } else if (
    financialHealth.status === 'warning' ||
    financialHealth.status === 'deficit'
  ) {
    healthStatusClass = 'health-status-warning';
    healthText = 'Finance fragile : taux majorés';
  }

  healthImpactEl.innerHTML = html`
        <div class="${healthStatusClass}">
            <span class="health-text">${healthText}</span>
        </div>
    `;
}

/**
 * @param {{ bank: number, commercial: number }} rates per year, a fraction
 */
export function renderLoanRates(rates) {
  updateLoansElement('bank-rate', formatYearlyRate(rates.bank));
  updateLoansElement('commercial-rate', formatYearlyRate(rates.commercial));
}

/**
 * Puts the contract form back in its parking list and closes every offer: the form lives under the offer that was picked, and must not be lost when the offers are drawn again.
 */
export function parkLoanForm() {
  const form = document.getElementById('loan-form-section');
  const park = document.querySelector('.loan-form-park');
  if (!form || !park) return;
  form.style.display = 'none';
  park.append(form);
  document.querySelectorAll('#loans-panel .loan-option.is-open').forEach((option) => option.classList.remove('is-open'));
  document.querySelectorAll('#loans-panel .loan-select-btn[aria-expanded="true"]').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Contracter';
  });
}

/**
 * The partner cities that lend, one option each (same markup as the bank's), or a sentence when none does.
 * @param {Array<{ cityId: string, cityName: string, maxAmount: number, yearlyRate: number }>} lenders
 */
export function renderExternalLenders(lenders) {
  const container = document.getElementById('external-loans');
  if (!container) return;
  // The form may sit under one of these offers: it is parked first, or drawing the list again would throw it away.
  parkLoanForm();
  if (lenders.length === 0) {
    container.innerHTML = html`<li class="loan-description">Aucune ville partenaire ne prête pour l'instant : il faut commercer avec elle.</li>`;
    return;
  }
  container.innerHTML = html`${lenders
    .map(
      (lender) => html`
                <li class="loan-option">
                    <div class="loan-info">
                        <h5 class="loan-name">${lender.cityName}</h5>
                        <p class="loan-description">Argent venu de l'étranger : intérêts et remboursements sortent de l'économie</p>
                        <dl class="loan-terms">
                            <div><dt>Montant</dt><dd>jusqu'à ${lender.maxAmount} €</dd></div>
                            <div><dt>Taux</dt><dd>${formatYearlyRate(lender.yearlyRate)}</dd></div>
                            <div><dt>Durée</dt><dd>15 – 30 tours</dd></div>
                        </dl>
                    </div>
                    <button type="button" class="loan-select-btn" data-loan-type="external" data-lender-city="${lender.cityId}" data-lender-name="${lender.cityName}" data-max-amount="${lender.maxAmount}" aria-expanded="false">Contracter</button>
                </li>`
    )}`;
}

/**
 * The loan's schedule, turn by turn: the same installment every turn, the one the payments book (accounting.loanInstallmentOf).
 * @param {object} loan
 * @param {(loan: object) => { payment: number, interest: number, principal: number }} installmentOf
 * @returns {{ schedule: Array<object>, remainingInterest: number }}
 */
export function generateAmortizationSchedule(loan, installmentOf) {
  const schedule = [];
  const { payment, interest, principal } = installmentOf(loan);
  let remainingBalance = loan.amount;
  let totalInterestPaid = 0;
  const paidTurns = loan.duration - loan.remainingTurns;

  for (let turn = 1; turn <= loan.duration; turn++) {
    const isPaid = turn <= paidTurns;

    if (isPaid) {
      remainingBalance = Math.max(0, remainingBalance - principal);
      totalInterestPaid += interest;
    }

    schedule.push({
      turn,
      payment,
      interest,
      principal,
      balance: remainingBalance,
      paid: isPaid,
    });
  }

  const remainingInterest = Math.max(0, loan.interest - totalInterestPaid);

  return {
    schedule,
    remainingInterest,
  };
}

/** @param {{ type: string, lenderCityName?: string }} loan @returns {string} the kind of loan and, for a partner city's, who lends it */
function loanTypeLabelOf(loan) {
  if (loan.type === 'external') {
    if (!loan.lenderCityName) throw new Error(`[loans] the external loan ${loan.id} names no lender city`);
    return loan.lenderCityName;
  }
  return loan.type === 'bank' ? 'Prêt bancaire' : 'Prêt commercial';
}

/**
 * @param {Array<object>} activeLoans
 * @param {(loan: object) => { payment: number, interest: number, principal: number }} installmentOf a turn's installment of a loan (accounting.loanInstallmentOf)
 * @returns {string}
 */
export function renderActiveLoansHtml(activeLoans, installmentOf) {
  if (activeLoans.length === 0) {
    return html`<p class="no-loans">Aucun prêt en cours</p>`;
  }

  return html`${activeLoans
    .map((loan) => {
      const amortizationSchedule = generateAmortizationSchedule(loan, installmentOf);
      const paidShare = Math.round(((loan.duration - loan.remainingTurns) / loan.duration) * 100);

      return html`
                <article class="loan-item">
                    <header class="loan-item-header">
                        <h4 class="loan-type">${loanTypeLabelOf(loan)}</h4>
                        <p class="loan-amount">${loan.amount} €</p>
                    </header>
                    <div class="loan-progress-bar" role="img" aria-label="${paidShare} % remboursé"><span style="width:${paidShare}%"></span></div>
                    <p class="loan-progress">${loan.remainingTurns} tours restants sur ${loan.duration}</p>
                    <dl class="loan-terms">
                        <div><dt>Taux</dt><dd>${formatYearlyRate(loan.interestRate)}</dd></div>
                        <div><dt>À rembourser</dt><dd>${loan.total} €</dd></div>
                        <div><dt>Intérêts restants</dt><dd>${amortizationSchedule.remainingInterest} €</dd></div>
                    </dl>

                    <details class="amortization-schedule">
                        <summary>Tableau d'amortissement</summary>
                        <div class="schedule-table">
                            <div class="schedule-header">
                                <div class="col-turn">Tour</div>
                                <div class="col-payment">Paiement</div>
                                <div class="col-interest">Intérêts</div>
                                <div class="col-principal">Capital</div>
                                <div class="col-balance">Solde</div>
                            </div>
                            ${amortizationSchedule.schedule
                              .map(
                                (row) => html`
                                <div class="schedule-row ${row.paid ? 'paid' : ''}">
                                    <div class="col-turn">${row.turn}</div>
                                    <div class="col-payment">${row.payment}€</div>
                                    <div class="col-interest">${row.interest}€</div>
                                    <div class="col-principal">${row.principal}€</div>
                                    <div class="col-balance">${row.balance}€</div>
                                </div>
                            `
                              )}
                        </div>
                    </details>
                </article>
            `;
    })}`;
}

/** @returns {import('../../shell/safeHtml.js').SafeHtml} */
export function renderActiveLoansErrorHtml() {
  return html`<p class="no-loans">Les prêts en cours n'ont pas pu être chargés.</p>`;
}
