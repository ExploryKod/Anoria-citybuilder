import db from '../../core/persistence/dexie/db.js';
import config from '../game/config.js';
import journalManager from './JournalManager.js';
import * as accountingGame from '../acl/accountingGame.js';

/**
 * BudgetManager — thin façade for UI and legacy callers.
 * Treasury lifecycle and writes delegate to Accounting BC via acl/accounting.js.
 */
class BudgetManager {
    constructor() {
        this.db = db;
        this.journalManager = journalManager;
    }

    /**
     * Initialize budget with starting funds
     * @param {number} startingFunds - Initial funds (default: from config)
     */
    async initialize(startingFunds = null) {
        const { initializeTreasury } = await import('../acl/accounting.js');
        return initializeTreasury(startingFunds);
    }

    /**
     * Calculate loan totals from budget loans array
     * @param {Object} [_budget] - Ignored; kept for API compatibility
     */
    async calculateLoanTotals(_budget) {
        const { recalculateLoanTotals } = await import('../acl/accounting.js');
        return recalculateLoanTotals();
    }

    /**
     * Get current budget state
     * @returns {Promise<Object>} Current budget data
     */
    async getCurrentBudget() {
        const { getTreasurySnapshot } = await import('../acl/accounting.js');
        return getTreasurySnapshot();
    }

    /**
     * Construction placement refund (journal + treasury).
     * @param {number} amount
     * @param {string} description
     * @param {{ buildingInstanceId?: string }} [options]
     */
    async addConstructionRefund(amount, description, options = {}) {
        const budget = await this.getCurrentBudget();
        const roundedAmount = Math.round(amount);

        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        await getOrCreateAccountingContext().recordConstructionRefundIncome({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            buildingInstanceId: options.buildingInstanceId ?? null,
        });

        return await this.getCurrentBudget();
    }

    /**
     * Add loan to budget (principal amount)
     * @param {number} amount - Loan principal amount
     * @param {string} description - Description of loan
     */
    async addLoan(amount, description = 'Loan', loanData = null) {
        return accountingGame.recordLoanCapital(amount, description, loanData);
    }

    async addLoanInterest(amount, description = 'Loan Interest', loanId = null) {
        return accountingGame.recordLoanInterest(amount, description, loanId);
    }

    async repayLoan(amount, description = 'Loan Repayment', loanId = null) {
        return accountingGame.recordLoanRepayment(amount, description, loanId);
    }

    async recordInfoLoanInstallment(params) {
        return accountingGame.recordInfoLoanInstallment(params);
    }

    /**
     * Advance loan schedule when an installment could not be paid (no capital reduction).
     * @param {string} loanId
     */
    async advanceLoanInstallmentWithoutPayment(loanId) {
        const { advanceLoanInstallmentWithoutPayment } = await import('../acl/accounting.js');
        return advanceLoanInstallmentWithoutPayment(loanId);
    }

    /**
     * Get active loans from budget
     * @returns {Promise<Array>} Array of active loans
     */
    async getActiveLoans() {
        const { getActiveLoans } = await import('../acl/accounting.js');
        return getActiveLoans();
    }

    /**
     * Add construction expense to budget (building purchases)
     * @param {number} amount - Construction expense amount
     * @param {string} reason - Reason for expense (e.g., "Building: House")
     * @param {{ buildingInstanceId?: string }} [options]
     * @returns {Promise<Object>} Result object with success status
     */
    async addConstructionExpense(amount, reason = "unknown", options = {}) {
        const budget = await this.getCurrentBudget();
        
        // Validate input amount
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid expense amount: ${amount} (type: ${typeof amount})`);
            return {
                success: false,
                reason: 'invalid_amount',
                message: `Invalid expense amount: ${amount}`
            };
        }

        try {
            const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
            const result = await getOrCreateAccountingContext().recordConstructionExpense({
                turn: budget.turn,
                amount,
                description: reason,
                buildingInstanceId: options.buildingInstanceId ?? null,
            });

            if (!result.recorded) {
                return {
                    success: false,
                    reason: result.reason ?? 'not_recorded',
                    message: `Construction expense not recorded: ${result.reason ?? 'unknown'}`,
                };
            }

            const updatedBudget = await this.getCurrentBudget();

            return {
                success: true,
                budget: updatedBudget,
                message: `Expense of ${amount}€ processed for ${reason}`
            };
        } catch (error) {
            console.error('Error processing expense:', error);
            return {
                success: false,
                reason: 'database_error',
                error: error
            };
        }
    }

    /**
     * Add journal entry (écriture comptable)
     * Delegates to JournalManager
     * @param {number} turn - Turn number
     * @param {string} type - Type of entry ('income', 'expense', 'loan_interest', 'loan_repayment', etc.)
     * @param {number} amount - Amount
     * @param {string} description - Description
     */
    async addJournalEntry(turn, type, amount, description) {
        return await this.journalManager.addJournalEntry(turn, type, amount, description);
    }

    /**
     * Get journal entries
     * Delegates to JournalManager
     * @param {number} maxAge - Maximum age in days (optional)
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntries(maxAge = null) {
        return await this.journalManager.getJournalEntries(maxAge);
    }

    /**
     * Get journal entries for a specific turn
     * Delegates to JournalManager
     * @param {number} turn - Turn number
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntriesForTurn(turn) {
        return await this.journalManager.getJournalEntriesForTurn(turn);
    }

    /**
     * Cleanup old journal entries
     * Delegates to JournalManager
     * @param {number} maxAge - Maximum age in days
     */
    async cleanupOldJournalEntries(maxAge = 60) {
        return await this.journalManager.cleanupOldJournalEntries(maxAge);
    }

    /**
     * Get financial summary grouped by month
     * Delegates to JournalManager
     * @returns {Promise<Array>} Array of monthly summaries
     */
    async getMonthlyFinancialSummary() {
        return await this.journalManager.getMonthlyFinancialSummary();
    }

    /**
     * Get financial summary grouped by year
     * Delegates to JournalManager
     * @returns {Promise<Array>} Array of yearly summaries
     */
    async getYearlyFinancialSummary() {
        return await this.journalManager.getYearlyFinancialSummary();
    }

    /**
     * Get budget summary for display
     * @returns {Promise<Object>} Budget summary
     */
    async getBudgetSummary() {
        return accountingGame.getBudgetSummary();
    }

    /**
     * Update turn and reset daily income/expenses (keep running totals)
     * @param {number} turn - Current turn number
     */
    async updateTurn(turn) {
        const { updateTreasuryTurn } = await import('../acl/accounting.js');
        return updateTreasuryTurn(turn);
    }

    /**
     * Add import expense (achat de produits depuis l'extérieur)
     * @param {number} amount - Coût total de l'import
     * @param {string} description - Description de l'import
     * @param {string} productId - ID du produit (wheat, carrot, etc.)
     * @returns {Promise<Object>} Updated budget
     */
    async addImportExpense(amount, description, productId = 'unknown', partnerId = null) {
        return accountingGame.recordImportExpense(amount, description, productId, partnerId);
    }

    async addExportIncome(amount, description, productId = 'unknown', partnerId = null) {
        return accountingGame.recordExportIncome(amount, description, productId, partnerId);
    }

    /**
     * Random event repair expense (journal + treasury).
     * @param {number} amount
     * @param {string} description
     */
    async addExceptionalExpense(amount, description) {
        return accountingGame.recordExceptionalRepairExpense(amount, description);
    }

    async addCommercialRouteFee(amount, description, partnerId) {
        return accountingGame.recordCommercialRouteFee(amount, description, partnerId);
    }

    /**
     * Add building maintenance expenses only
     * @param {number} amount - Building maintenance cost
     * @param {string} description - Optional custom description (default: 'Maintenance bâtiments')
     */
    async addBuildingMaintenance(amount, description = 'Maintenance bâtiments', turn = null) {
        return accountingGame.recordBuildingMaintenance(amount, description, turn, { db: this.db });
    }

    /**
     * Add salaries expense (salaire brut mensuel × population totale)
     * Called once per month on the first turn of each month
     * @param {number} salaryPerMonth - Salary per citizen per month (from workSectionManager)
 * @param {number} population - Total population (from Housing ACL)
     * @param {string} description - Optional custom description
     * @returns {Promise<Object>} Updated budget
     */
    async addSalaries(salaryPerMonth, population, description = null, turn = null) {
        return accountingGame.recordSalaries(salaryPerMonth, population, description, turn);
    }

    async addSalaryTax(salaryAmount, taxRate, description = null, turn = null) {
        return accountingGame.recordPayrollTax(salaryAmount, taxRate, description, turn);
    }

    /**
     * Add taxes based on population (configurable amount per citizen, only in November)
     * Calculates taxes from houses in the database
     * Only collects taxes if there is population AND it's November (month index 10)
     * Taxes are collected only ONCE per year (first day of November)
     * The amount per citizen is configurable via finances-tax-controls (default: 100€)
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<Object>} Updated budget
     */
    async addTaxes(time = 0) {
        return accountingGame.collectCitizenTaxes(time, { db: this.db });
    }

    /**
     * Get detailed income breakdown
     * @returns {Promise<Object>} Income breakdown with taxes and other sources
     */
    async getIncomeBreakdown() {
        return accountingGame.getIncomeBreakdown();
    }

    async getExpenseBreakdown() {
        return accountingGame.getExpenseBreakdown();
    }

    /**
     * Force reinitialize budget (useful for fixing corrupted data)
     * @param {number} startingFunds - Starting funds amount (default: from config)
     */
    async forceReinitialize(startingFunds = null) {
        const { resetAccountingContextForTests, forceReinitializeTreasury } = await import('../acl/accounting.js');
        const { resetSessionLedgerBufferForTests } = await import('./SessionLedgerBuffer.js');

        resetSessionLedgerBufferForTests();
        resetAccountingContextForTests();

        return forceReinitializeTreasury(startingFunds);
    }

    /**
     * Get financial health status
     * @returns {Promise<Object>} Financial health analysis
     */
    async getFinancialHealth() {
        const { getFinancialHealth } = await import('../acl/accounting.js');
        return getFinancialHealth();
    }
}

const budgetManager = new BudgetManager();

export { BudgetManager };
export default budgetManager;
