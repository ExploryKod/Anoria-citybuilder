import { TreasuryWritePort } from '../../../application/ports/TreasuryWritePort.js';

/**
 * Phase 3½ adapter — treasury debits via BudgetManager + Dexie budget row.
 */
export class LegacyTreasuryWriteAdapter extends TreasuryWritePort {
  /** @param {import('../../../../../js/stores/BudgetManager.js').default|object} budgetManager */
  constructor(budgetManager) {
    super();
    this.budgetManager = budgetManager;
  }

  /** @inheritdoc */
  async applyMaintenanceDebit(amount, maintenanceBreakdown = null) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

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

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyConstructionDebit(amount, description) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds - roundedAmount);

    const isBuildingInvestment =
      description.includes('Building:') || description.includes('building');

    if (isBuildingInvestment) {
      if (!budget.totalInvestments) {
        budget.totalInvestments = 0;
      }
      budget.totalInvestments = Math.round(
        budget.totalInvestments + roundedAmount
      );
    } else {
      budget.expenses = Math.round(budget.expenses + roundedAmount);
    }

    budget.netFlow = Math.round(budget.income - budget.expenses);
    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applySalaryDebit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds - roundedAmount);
    budget.expenses = Math.round(budget.expenses + roundedAmount);
    budget.dailyExpenses = Math.round(budget.dailyExpenses + roundedAmount);

    if (!budget.totalSalaries) {
      budget.totalSalaries = 0;
    }
    budget.totalSalaries = Math.round(budget.totalSalaries + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyPayrollTaxCredit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds + roundedAmount);
    budget.income = Math.round(budget.income + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyCitizenTaxCredit(amount, { taxBreakdown = null, taxYear = null } = {}) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

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

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyLoanCapitalCredit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds + roundedAmount);
    budget.income = Math.round(budget.income + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyLoanInterestDebit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

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

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyLoanRepaymentDebit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds - roundedAmount);
    budget.expenses = Math.round(budget.expenses + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    if (!budget.totalLoanRepayments) {
      budget.totalLoanRepayments = 0;
    }
    budget.totalLoanRepayments = Math.round(
      budget.totalLoanRepayments + roundedAmount
    );

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyCommerceImportDebit(amount, productId) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

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

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyCommerceExportCredit(amount, productId) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

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

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyExceptionalExpenseDebit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds - roundedAmount);
    budget.expenses = Math.round(budget.expenses + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyCommercialRouteDebit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.funds = Math.round(budget.funds - roundedAmount);
    budget.expenses = Math.round(budget.expenses + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyCapitalFundsIncomeCredit(amount) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    budget.income = Math.round(budget.income + roundedAmount);
    budget.netFlow = Math.round(budget.income - budget.expenses);

    await this.budgetManager.db.budget.put(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyConstructionRefundCredit(amount, description) {
    const budget = await this.budgetManager.getCurrentBudget();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

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
    await this.budgetManager.db.budget.put(budget);
    return budget;
  }
}
