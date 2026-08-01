/**
 * Financial health status from treasury snapshot.
 *
 * @param {object} budget
 * @returns {{ status: string, message: string, netFlow: number }}
 */
export function assessFinancialHealth(budget) {
  const netFlow = budget.dailyIncome - budget.dailyExpenses;

  let status = 'healthy';
  let message = 'Finances saines';

  if (budget.funds < 0) {
    status = 'critical';
    message = 'Faillite !';
  } else if (netFlow < -30 && budget.funds < 100) {
    status = 'critical';
    message = 'Danger : dépenses excessives';
  } else if (netFlow < -50) {
    status = 'critical';
    message = 'Déficit critique';
  } else if (netFlow < -20 && budget.funds < 100) {
    status = 'warning';
    message = 'Attention : déficit + fonds faibles';
  } else if (netFlow < -30 && budget.funds >= 100) {
    status = 'warning';
    message = 'Surveillez vos dépenses';
  } else if (budget.funds < 50 && netFlow >= 0) {
    status = 'warning';
    message = 'Fonds insuffisants';
  } else if (netFlow < 0 && budget.funds < 100) {
    status = 'deficit';
    message = 'Déficit + fonds limités';
  } else if (netFlow < 0 && budget.funds >= 100) {
    status = 'deficit';
    message = 'Déficitaire';
  } else if (budget.funds < 100 && netFlow >= 0 && netFlow < 20) {
    status = 'deficit';
    message = 'Fonds limités';
  } else if (netFlow > 100) {
    status = 'excellent';
    message = 'Excellent flux';
  } else if (budget.funds > 500 && netFlow > 50) {
    status = 'excellent';
    message = 'Très solide';
  } else if (budget.funds > 1000) {
    status = 'excellent';
    message = 'Très prospère';
  }

  return { status, message, netFlow };
}
