/**
 * PretsPresenter — rendu DOM des prêts (données déjà chargées).
 */

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
  let healthIcon = '✅';
  let healthText = 'Finance saine - Taux préférentiels disponibles';

  if (financialHealth.status === 'critical') {
    healthStatusClass = 'health-status-critical';
    healthIcon = '⚠️';
    healthText = 'Finance critique - Taux élevés appliqués';
  } else if (
    financialHealth.status === 'warning' ||
    financialHealth.status === 'deficit'
  ) {
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
 * @param {{ bank: number, commercial: number }} rates
 */
export function renderLoanRates(rates) {
  updateLoansElement('bank-rate', `Taux: ${rates.bank}%`);
  updateLoansElement('commercial-rate', `Taux: ${rates.commercial}%`);
}

/**
 * @param {object} loan
 * @returns {{ schedule: Array<object>, remainingInterest: number }}
 */
export function generateAmortizationSchedule(loan) {
  const schedule = [];
  const monthlyPayment = Math.round(loan.total / loan.duration);
  const interestRate = loan.interestRate / 100;
  let remainingBalance = loan.amount;
  let totalInterestPaid = 0;
  const paidTurns = loan.duration - loan.remainingTurns;

  const totalInterest = loan.interest || Math.round(loan.amount * interestRate);

  for (let turn = 1; turn <= loan.duration; turn++) {
    const interestPayment = Math.round((remainingBalance * interestRate) / loan.duration);
    const principalPayment = monthlyPayment - interestPayment;
    const isPaid = turn <= paidTurns;

    if (isPaid) {
      remainingBalance = Math.max(0, remainingBalance - principalPayment);
      totalInterestPaid += interestPayment;
    }

    schedule.push({
      turn,
      payment: monthlyPayment,
      interest: interestPayment,
      principal: principalPayment,
      balance: remainingBalance,
      paid: isPaid,
    });
  }

  const remainingInterest = Math.max(0, totalInterest - totalInterestPaid);

  return {
    schedule,
    remainingInterest,
  };
}

/**
 * @param {Array<object>} activeLoans
 * @returns {string}
 */
export function renderActiveLoansHtml(activeLoans) {
  if (activeLoans.length === 0) {
    return `
                <div class="no-loans">
                    <span class="no-loans-icon">📭</span>
                    <span class="no-loans-text">Aucun prêt actif</span>
                </div>
            `;
  }

  return activeLoans
    .map((loan) => {
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
                            ${amortizationSchedule.schedule
                              .map(
                                (row) => `
                                <div class="schedule-row ${row.paid ? 'paid' : ''}">
                                    <div class="col-turn">${row.turn}</div>
                                    <div class="col-payment">${row.payment}€</div>
                                    <div class="col-interest">${row.interest}€</div>
                                    <div class="col-principal">${row.principal}€</div>
                                    <div class="col-balance">${row.balance}€</div>
                                </div>
                            `
                              )
                              .join('')}
                        </div>
                    </div>
                </div>
            `;
    })
    .join('');
}

/** @returns {string} */
export function renderActiveLoansErrorHtml() {
  return `
            <div class="no-loans">
                <span class="no-loans-icon">❌</span>
                <span class="no-loans-text">Erreur lors du chargement</span>
            </div>
        `;
}
