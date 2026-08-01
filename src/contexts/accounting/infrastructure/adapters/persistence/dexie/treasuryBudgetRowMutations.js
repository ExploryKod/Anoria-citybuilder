function roundAmount(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    return null;
  }
  const rounded = Math.round(amount);
  return rounded > 0 ? rounded : null;
}

/** @param {object} budget @param {number} amount @param {object|null} maintenanceBreakdown */
export function applyMaintenanceDebitMutation(budget, amount, maintenanceBreakdown = null) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.dailyExpenses = Math.round(budget.dailyExpenses + roundedAmount);

  if (!budget.totalBuildingMaintenance) {
    budget.totalBuildingMaintenance = 0;
  }
  budget.totalBuildingMaintenance = Math.round(
    budget.totalBuildingMaintenance + roundedAmount
  );
  budget.netFlow = Math.round(budget.income - budget.expenses);

  if (maintenanceBreakdown) {
    budget.maintenanceBreakdown = maintenanceBreakdown;
  }

  return budget;
}

/** @param {object} budget @param {number} amount @param {string} description */
export function applyConstructionDebitMutation(budget, amount, description) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);

  const isBuildingInvestment =
    description.includes('Building:') || description.includes('building');

  if (isBuildingInvestment) {
    if (!budget.totalInvestments) {
      budget.totalInvestments = 0;
    }
    budget.totalInvestments = Math.round(budget.totalInvestments + roundedAmount);
  } else {
    budget.expenses = Math.round(budget.expenses + roundedAmount);
  }

  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount */
export function applySalaryDebitMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.dailyExpenses = Math.round(budget.dailyExpenses + roundedAmount);

  if (!budget.totalSalaries) {
    budget.totalSalaries = 0;
  }
  budget.totalSalaries = Math.round(budget.totalSalaries + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyPayrollTaxCreditMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds + roundedAmount);
  budget.income = Math.round(budget.income + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/**
 * @param {object} budget
 * @param {number} amount
 * @param {{ taxBreakdown?: object|null, taxYear?: number|null }} [options]
 */
export function applyCitizenTaxCreditMutation(budget, amount, { taxBreakdown = null, taxYear = null } = {}) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds + roundedAmount);
  budget.income = Math.round(budget.income + roundedAmount);
  budget.dailyIncome = Math.round(budget.dailyIncome + roundedAmount);

  if (!budget.totalTaxes) {
    budget.totalTaxes = 0;
  }
  budget.totalTaxes = Math.round(budget.totalTaxes + roundedAmount);

  if (taxBreakdown) {
    budget.taxBreakdown = taxBreakdown;
  }
  if (taxYear != null) {
    budget.lastTaxYear = taxYear;
  }

  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyLoanCapitalCreditMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds + roundedAmount);
  budget.income = Math.round(budget.income + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyLoanInterestDebitMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);

  if (!budget.totalLoanInterest) {
    budget.totalLoanInterest = 0;
  }
  budget.totalLoanInterest = Math.round(budget.totalLoanInterest + roundedAmount);

  if (!budget.totalLoanInterestExpenses) {
    budget.totalLoanInterestExpenses = 0;
  }
  budget.totalLoanInterestExpenses = Math.round(
    budget.totalLoanInterestExpenses + roundedAmount
  );

  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyLoanRepaymentDebitMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);

  if (!budget.totalLoanRepayments) {
    budget.totalLoanRepayments = 0;
  }
  budget.totalLoanRepayments = Math.round(
    budget.totalLoanRepayments + roundedAmount
  );

  return budget;
}

/** @param {object} budget @param {number} amount @param {string} productId */
export function applyCommerceImportDebitMutation(budget, amount, productId) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.dailyExpenses = Math.round(budget.dailyExpenses + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);

  if (!budget.totalImports) {
    budget.totalImports = {};
  }
  if (!budget.totalImports[productId]) {
    budget.totalImports[productId] = 0;
  }
  budget.totalImports[productId] = Math.round(
    budget.totalImports[productId] + roundedAmount
  );

  return budget;
}

/** @param {object} budget @param {number} amount @param {string} productId */
export function applyCommerceExportCreditMutation(budget, amount, productId) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds + roundedAmount);
  budget.income = Math.round(budget.income + roundedAmount);
  budget.dailyIncome = Math.round(budget.dailyIncome + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);

  if (!budget.totalExports) {
    budget.totalExports = {};
  }
  if (!budget.totalExports[productId]) {
    budget.totalExports[productId] = 0;
  }
  budget.totalExports[productId] = Math.round(
    budget.totalExports[productId] + roundedAmount
  );

  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyExceptionalExpenseDebitMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyCommercialRouteDebitMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds - roundedAmount);
  budget.expenses = Math.round(budget.expenses + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount */
export function applyCapitalFundsIncomeCreditMutation(budget, amount) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.income = Math.round(budget.income + roundedAmount);
  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}

/** @param {object} budget @param {number} amount @param {string} description */
export function applyConstructionRefundCreditMutation(budget, amount, description) {
  const roundedAmount = roundAmount(amount);
  if (!roundedAmount) return budget;

  budget.funds = Math.round(budget.funds + roundedAmount);

  const isBuildingInvestment =
    description.includes('Building:') ||
    description.includes('building') ||
    description.includes('Refund for');

  if (isBuildingInvestment) {
    if (!budget.totalInvestments) {
      budget.totalInvestments = 0;
    }
    budget.totalInvestments = Math.max(
      0,
      Math.round(budget.totalInvestments - roundedAmount)
    );
  } else {
    budget.expenses = Math.max(0, Math.round(budget.expenses - roundedAmount));
  }

  budget.netFlow = Math.round(budget.income - budget.expenses);
  return budget;
}
