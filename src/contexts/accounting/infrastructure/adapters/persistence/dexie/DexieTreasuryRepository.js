import db from '../../../../../../core/persistence/dexie/db.js';
import { TreasuryRepository } from '../../../../application/ports/TreasuryRepository.js';
import { normalizeTreasuryBudgetRow } from './normalizeTreasuryBudgetRow.js';

export const CURRENT_BUDGET_NAME = 'budget_current';

/**
 * Accounting BC — direct Dexie access to co-maintained treasury (`budget_current`).
 */
export class DexieTreasuryRepository extends TreasuryRepository {
  /**
   * @param {object} [deps]
   * @param {import('dexie').Dexie} [deps.db]
   * @param {number} [deps.expectedInitialFunds]
   */
  constructor(deps = {}) {
    super();
    this.db = deps.db ?? db;
    this.expectedInitialFunds = deps.expectedInitialFunds ?? 200;
  }

  /** @returns {Promise<number>} */
  async getTreasuryBalance() {
    const budget = await this.getRawBudgetRow();
    if (!budget || typeof budget.funds !== 'number') {
      return 0;
    }
    return Math.round(budget.funds);
  }

  /** @returns {Promise<object|null>} */
  async getRawBudgetRow() {
    let budget = await this.db.budget.get(CURRENT_BUDGET_NAME);

    if (!budget) {
      const all = await this.db.budget.toArray();
      budget = all.find((row) => row.name === CURRENT_BUDGET_NAME) ?? all[0] ?? null;
    }

    return budget;
  }

  /** @param {object} budget @returns {Promise<object>} */
  async saveBudgetRow(budget) {
    await this.db.budget.put(budget);
    return budget;
  }

  /** @param {object} budget @returns {Promise<object>} */
  async recalculateLoanTotals(budget) {
    if (!budget.loans || !Array.isArray(budget.loans)) {
      budget.loans = [];
      budget.loanDebt = 0;
      if (budget.totalLoanInterest === undefined) budget.totalLoanInterest = 0;
      if (budget.totalLoanRepayments === undefined) budget.totalLoanRepayments = 0;
      if (budget.totalLoanInterestExpenses === undefined) {
        budget.totalLoanInterestExpenses = 0;
      }
      return budget;
    }

    let totalLoanDebt = 0;
    budget.loans.forEach((loan) => {
      totalLoanDebt += loan.amount || 0;
    });
    budget.loanDebt = totalLoanDebt;

    if (budget.totalLoanInterest === undefined) budget.totalLoanInterest = 0;
    if (budget.totalLoanRepayments === undefined) budget.totalLoanRepayments = 0;
    if (budget.totalLoanInterestExpenses === undefined) {
      budget.totalLoanInterestExpenses = 0;
    }

    return budget;
  }

  /**
   * Load, normalize and persist treasury row if needed.
   * @returns {Promise<object|null>}
   */
  async getNormalizedBudgetRow() {
    const budget = await this.getRawBudgetRow();
    if (!budget) {
      return null;
    }

    const { budget: normalized, needsUpdate } = normalizeTreasuryBudgetRow(
      budget,
      this.expectedInitialFunds
    );
    await this.recalculateLoanTotals(normalized);

    if (needsUpdate) {
      await this.saveBudgetRow(normalized);
    }

    return normalized;
  }

  /** @returns {Promise<void>} */
  async clearCurrentBudget() {
    await this.db.budget.clear();
  }

  /**
   * @param {number} startingFunds
   * @returns {Promise<object>}
   */
  async createInitialBudgetRow(startingFunds) {
    const initialBudget = {
      name: CURRENT_BUDGET_NAME,
      funds: startingFunds,
      initialFunds: startingFunds,
      income: startingFunds,
      expenses: 0,
      netFlow: startingFunds,
      turn: 0,
      dailyIncome: 0,
      dailyExpenses: 0,
      totalTaxes: 0,
      totalMaintenance: 0,
      totalSalaries: 0,
      totalBuildingMaintenance: 0,
      totalInvestments: 0,
      totalLoanInterestExpenses: 0,
      loans: [],
      loanDebt: 0,
      totalLoanInterest: 0,
      totalLoanRepayments: 0,
    };

    await this.db.budget.add(initialBudget);
    return initialBudget;
  }
}
