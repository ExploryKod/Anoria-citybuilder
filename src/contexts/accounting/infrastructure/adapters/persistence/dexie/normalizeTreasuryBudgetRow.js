/**
 * Normalize and migrate co-maintained treasury row (`budget_current`).
 *
 * @param {object} budget
 * @param {number} expectedInitialFunds
 * @returns {{ budget: object, needsUpdate: boolean }}
 */
export function normalizeTreasuryBudgetRow(budget, expectedInitialFunds) {
  let needsUpdate = false;

  if (typeof budget.funds === 'number') budget.funds = Math.round(budget.funds);
  if (typeof budget.income === 'number') budget.income = Math.round(budget.income);
  if (typeof budget.expenses === 'number') budget.expenses = Math.round(budget.expenses);
  if (typeof budget.netFlow === 'number') budget.netFlow = Math.round(budget.netFlow);
  if (typeof budget.dailyIncome === 'number') {
    budget.dailyIncome = Math.round(budget.dailyIncome);
  }
  if (typeof budget.dailyExpenses === 'number') {
    budget.dailyExpenses = Math.round(budget.dailyExpenses);
  }
  if (typeof budget.totalTaxes === 'number') {
    budget.totalTaxes = Math.round(budget.totalTaxes);
  }
  if (typeof budget.totalBuildingMaintenance === 'number') {
    budget.totalBuildingMaintenance = Math.round(budget.totalBuildingMaintenance);
  }
  if (typeof budget.totalInvestments === 'number') {
    budget.totalInvestments = Math.round(budget.totalInvestments);
  }
  if (typeof budget.totalSalaries === 'number') {
    budget.totalSalaries = Math.round(budget.totalSalaries);
  }
  if (typeof budget.totalLoanInterest === 'number') {
    budget.totalLoanInterest = Math.round(budget.totalLoanInterest);
  }
  if (typeof budget.totalLoanInterestExpenses === 'number') {
    budget.totalLoanInterestExpenses = Math.round(budget.totalLoanInterestExpenses);
  }
  if (typeof budget.totalLoanRepayments === 'number') {
    budget.totalLoanRepayments = Math.round(budget.totalLoanRepayments);
  }

  if (budget.initialFunds !== expectedInitialFunds) {
    const oldInitialFunds = budget.initialFunds || 200;
    budget.initialFunds = expectedInitialFunds;
    needsUpdate = true;

    if (budget.turn === 0) {
      const fundsMatchOldInitial = Math.abs(budget.funds - oldInitialFunds) < 1;
      const noTransactions =
        (budget.income === 0 || budget.income === undefined) &&
        (budget.expenses === 0 || budget.expenses === undefined);

      if (fundsMatchOldInitial && noTransactions) {
        if (expectedInitialFunds > budget.funds) {
          budget.funds = expectedInitialFunds;
          needsUpdate = true;
        }
      }
    }
  } else if (budget.turn === 0 && Math.abs(budget.funds - expectedInitialFunds) > 1) {
    const noTransactions =
      (budget.income === 0 || budget.income === undefined) &&
      (budget.expenses === 0 || budget.expenses === undefined);

    if (noTransactions && expectedInitialFunds > budget.funds) {
      budget.funds = expectedInitialFunds;
      needsUpdate = true;
    }
  }

  const defaultFields = [
    ['totalTaxes', 0],
    ['totalMaintenance', 0],
    ['totalSalaries', 0],
    ['totalBuildingMaintenance', 0],
    ['totalInvestments', 0],
    ['totalLoanInterestExpenses', 0],
    ['initialFunds', expectedInitialFunds],
  ];

  for (const [field, defaultValue] of defaultFields) {
    if (budget[field] === undefined) {
      budget[field] = defaultValue;
      needsUpdate = true;
    }
  }

  return { budget, needsUpdate };
}
