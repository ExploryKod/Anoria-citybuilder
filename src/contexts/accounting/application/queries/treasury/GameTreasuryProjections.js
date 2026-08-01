/** @param {object} budget */
export function buildBudgetSummary(budget) {
  return {
    funds: budget.funds,
    expenses: budget.expenses,
    income: budget.income,
    netFlow: budget.netFlow,
    turn: budget.turn,
    isProfitable: budget.netFlow > 0,
    isInDebt: budget.funds < 0,
    loanDebt: budget.loanDebt || 0,
    totalLoanInterest: budget.totalLoanInterest || 0,
    totalLoanRepayments: budget.totalLoanRepayments || 0,
  };
}

/** @param {object} budget */
export function buildIncomeBreakdown(budget) {
  return {
    totalIncome: budget.income || 0,
    dailyIncome: budget.dailyIncome || 0,
    taxes: budget.totalTaxes || 0,
    otherIncome: (budget.income || 0) - (budget.totalTaxes || 0),
  };
}

/** @param {object} budget */
export function buildExpenseBreakdown(budget) {
  return {
    totalExpenses: budget.expenses || 0,
    dailyExpenses: budget.dailyExpenses || 0,
    buildingMaintenance: budget.totalBuildingMaintenance || 0,
    investments: budget.totalInvestments || 0,
  };
}

/** @param {object} budget @param {number} amount */
export function canAffordFromBudget(budget, amount) {
  return budget.funds >= amount;
}
