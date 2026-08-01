import { formatEuro } from './formatMoney.js';

/** @param {string} status */
export function financialHealthStatusLabel(status) {
  const statusMap = {
    healthy: 'Sain',
    warning: 'Attention',
    critical: 'Critique',
    excellent: 'Excellent',
    deficit: 'Déficitaire',
  };
  return statusMap[status] || 'Inconnu';
}

/** @param {number} funds */
export function treasuryFundsDisplayStyle(funds) {
  if (funds < 10) {
    return { color: '#ff6b6b', animation: 'pulse 1s infinite' };
  }
  if (funds < 50) {
    return { color: '#ffa726', animation: 'pulse 2s infinite' };
  }
  return { color: 'var(--cta)', animation: 'pulse 2s infinite' };
}

/** @param {number} netFlow */
export function netFlowDisplayStyle(netFlow) {
  if (netFlow > 0) {
    return { color: 'var(--success)' };
  }
  if (netFlow < 0) {
    return { color: 'var(--danger)' };
  }
  return { color: 'var(--cta)' };
}

/**
 * @param {object} params
 * @param {object} params.treasurySnapshot
 * @param {{ status: string, message: string }} params.financialHealth
 * @param {{ taxes?: number, otherIncome?: number }} params.incomeBreakdown
 * @param {{ buildingMaintenance?: number, investments?: number }} params.expenseBreakdown
 * @param {number} params.population
 * @param {boolean} [params.populationError]
 */
export function buildRealtimeBudgetViewModel({
  treasurySnapshot,
  financialHealth,
  incomeBreakdown,
  expenseBreakdown,
  population,
  populationError = false,
}) {
  const funds = treasurySnapshot.funds || 0;
  const income = treasurySnapshot.income || 0;
  const expenses = treasurySnapshot.expenses || 0;
  const netFlow = income - expenses;

  return {
    funds: {
      text: formatEuro(funds),
      style: treasuryFundsDisplayStyle(funds),
    },
    income: formatEuro(income),
    expenses: formatEuro(expenses),
    netFlow: {
      text: formatEuro(netFlow),
      style: netFlowDisplayStyle(netFlow),
    },
    turn: treasurySnapshot.turn || 0,
    population: {
      text: population.toString(),
      error: populationError,
      title: populationError
        ? 'Erreur lors du chargement de la population'
        : `Population actuelle (${population} habitants)`,
    },
    health: {
      statusText: financialHealthStatusLabel(financialHealth.status),
      message: financialHealth.message,
      className: `realtime-health-status ${financialHealth.status}`,
    },
    taxes: formatEuro(incomeBreakdown.taxes || 0),
    otherIncome: formatEuro(incomeBreakdown.otherIncome || 0),
    buildingMaintenance: formatEuro(expenseBreakdown.buildingMaintenance || 0),
    loanInterest: formatEuro(treasurySnapshot.totalLoanInterestExpenses || 0),
    investments: formatEuro(expenseBreakdown.investments || 0),
  };
}

/**
 * @param {Array<{ id: string, type: string, amount: number, interestRate: number, duration: number }>} activeLoans
 */
export function buildLoanInterestDetailHtml(activeLoans) {
  if (activeLoans.length === 0) {
    return `
      <div class="no-loans-message">
        <span class="no-loans-icon">📭</span>
        <span class="no-loans-text">Aucun prêt actif</span>
      </div>
    `;
  }

  let totalInterest = 0;
  const loanCalculations = activeLoans
    .map((loan) => {
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
    })
    .join('');

  return `
    ${loanCalculations}
    <div class="loan-interest-calculation" style="border-left-color: var(--success); background: rgba(0, 255, 0, 0.05);">
      <div class="loan-interest-calculation-header">
        <div class="loan-interest-calculation-title">💰 Total Intérêts par Tour</div>
        <div class="loan-interest-calculation-amount" style="color: var(--success);">${totalInterest.toLocaleString('fr-FR')}€</div>
      </div>
    </div>
  `;
}
