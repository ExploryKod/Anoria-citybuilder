import { GetTreasurySnapshot } from '../queries/treasury/GetTreasurySnapshot.js';

/**
 * Loan portfolio mutations on treasury row (not journal).
 */
export class TreasuryLoanPortfolio {
  /**
   * @param {import('../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {GetTreasurySnapshot} getTreasurySnapshot
   */
  constructor(treasuryRepository, getTreasurySnapshot) {
    this.treasuryRepository = treasuryRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /** @returns {Promise<Array>} */
  async getActiveLoans() {
    const budget = await this.getTreasurySnapshot.execute();
    return budget.loans || [];
  }

  /**
   * @param {object} loanData
   * @returns {Promise<object>}
   */
  async addLoanToPortfolio(loanData) {
    const budget = await this.getTreasurySnapshot.execute();

    if (!budget.loans) {
      budget.loans = [];
    }

    if (loanData) {
      budget.loans.push(loanData);
    }

    await this.treasuryRepository.recalculateLoanTotals(budget);
    await this.treasuryRepository.saveBudgetRow(budget);
    return budget;
  }

  /**
   * @param {string} loanId
   * @param {number} repaymentAmount
   * @returns {Promise<object>}
   */
  async applyRepaymentToPortfolio(loanId, repaymentAmount) {
    const budget = await this.getTreasurySnapshot.execute();

    if (!loanId || !budget.loans?.length) {
      return budget;
    }

    const loan = budget.loans.find((l) => l.id === loanId);
    if (!loan) {
      return budget;
    }

    loan.amount = Math.max(0, loan.amount - repaymentAmount);
    loan.remainingTurns = Math.max(0, (loan.remainingTurns ?? 1) - 1);

    if (loan.remainingTurns <= 0 || loan.amount <= 0) {
      budget.loans = budget.loans.filter((l) => l.id !== loanId);
    }

    await this.treasuryRepository.recalculateLoanTotals(budget);
    await this.treasuryRepository.saveBudgetRow(budget);
    return budget;
  }

  /**
   * @param {string} loanId
   * @returns {Promise<object>}
   */
  async advanceInstallmentWithoutPayment(loanId) {
    const budget = await this.getTreasurySnapshot.execute();

    if (!loanId || !budget.loans?.length) {
      return budget;
    }

    const loan = budget.loans.find((l) => l.id === loanId);
    if (!loan) {
      return budget;
    }

    loan.remainingTurns = Math.max(0, (loan.remainingTurns ?? 1) - 1);

    if (loan.remainingTurns <= 0) {
      budget.loans = budget.loans.filter((l) => l.id !== loanId);
    }

    await this.treasuryRepository.recalculateLoanTotals(budget);
    await this.treasuryRepository.saveBudgetRow(budget);
    return budget;
  }

  /** @returns {Promise<object>} */
  async recalculateLoanTotals() {
    const budget = await this.getTreasurySnapshot.execute();
    await this.treasuryRepository.recalculateLoanTotals(budget);
    await this.treasuryRepository.saveBudgetRow(budget);
    return budget;
  }
}
