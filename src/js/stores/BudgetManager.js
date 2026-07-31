import db from '../../core/persistence/dexie/db.js';
import config from '../game/config.js';
import journalManager from './JournalManager.js';

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
     * @deprecated Removed — use typed BC services (e.g. addConstructionRefund, addTaxes).
     */
    async addIncome(amount, source = 'unknown') {
        console.warn(
            `[BudgetManager] addIncome() is deprecated (source: ${source}). Use a typed accounting method.`
        );
        throw new Error('BudgetManager.addIncome is deprecated — use a typed Record* service');
    }

    /**
     * Add loan to budget (principal amount)
     * @param {number} amount - Loan principal amount
     * @param {string} description - Description of loan
     */
    async addLoan(amount, description = 'Loan', loanData = null) {
        const budget = await this.getCurrentBudget();
        const roundedAmount = Math.round(amount);

        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        const result = await getOrCreateAccountingContext().recordLoanCapitalIncome({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            loanId: loanData?.id ?? null,
        });

        if (!result.recorded) {
            return await this.getCurrentBudget();
        }

        if (loanData) {
            const { addLoanToPortfolio } = await import('../acl/accounting.js');
            return addLoanToPortfolio(loanData);
        }

        return await this.getCurrentBudget();
    }

    /**
     * Add loan interest expense to budget
     * @param {number} amount - Interest amount
     * @param {string} description - Description of interest
     * @param {string|null} [loanId]
     */
    async addLoanInterest(amount, description = 'Loan Interest', loanId = null) {
        const budget = await this.getCurrentBudget();
        const roundedAmount = Math.round(amount);

        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        await getOrCreateAccountingContext().recordLoanInterestExpense({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            loanId,
        });

        return await this.getCurrentBudget();
    }

    /**
     * Repay loan principal
     * @param {number} amount - Amount to repay
     * @param {string} description - Description of repayment
     */
    async repayLoan(amount, description = 'Loan Repayment', loanId = null) {
        const budget = await this.getCurrentBudget();
        const roundedAmount = Math.round(amount);

        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        const result = await getOrCreateAccountingContext().recordLoanRepaymentExpense({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            loanId,
        });

        if (!result.recorded) {
            return await this.getCurrentBudget();
        }

        if (loanId) {
            const { applyRepaymentToPortfolio } = await import('../acl/accounting.js');
            return applyRepaymentToPortfolio(loanId, amount);
        }

        return await this.getCurrentBudget();
    }

    /**
     * Journal-only: unpaid loan installment (informative — no treasury debit).
     * Types: `info_loan_interest`, `info_loan_repayment`.
     * @param {{ interestAmount?: number, principalAmount?: number, loanId: string, loanType?: string }} params
     */
    async recordInfoLoanInstallment({
        interestAmount = 0,
        principalAmount = 0,
        loanId,
        loanType = 'bank',
    }) {
        const budget = await this.getCurrentBudget();

        if (!loanId) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        await getOrCreateAccountingContext().recordInfoLoanInstallment({
            turn: budget.turn,
            interestAmount,
            principalAmount,
            loanId,
            loanType,
        });

        return budget;
    }

    /** @deprecated Use recordInfoLoanInstallment */
    async recordLoanDefaultInstallment(params) {
        return this.recordInfoLoanInstallment(params);
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
     * Check if we can afford an expense
     * @param {number} amount - Amount to check
     * @returns {Promise<boolean>} True if affordable
     */
    async canAfford(amount) {
        const budget = await this.getCurrentBudget();
        return budget.funds >= amount;
    }


    /**
     * Get budget summary for display
     * @returns {Promise<Object>} Budget summary
     */
    async getBudgetSummary() {
        const budget = await this.getCurrentBudget();
        
        return {
            funds: budget.funds,
            expenses: budget.expenses,
            income: budget.income,
            netFlow: budget.netFlow,
            turn: budget.turn,
            isProfitable: budget.netFlow > 0,
            isInDebt: budget.funds < 0,
            // Loan information
            loanDebt: budget.loanDebt || 0,
            totalLoanInterest: budget.totalLoanInterest || 0,
            totalLoanRepayments: budget.totalLoanRepayments || 0
        };
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
        const budget = await this.getCurrentBudget();

        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid import expense amount: ${amount}`);
            return budget;
        }

        const roundedAmount = Math.round(amount);
        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        await getOrCreateAccountingContext().recordCommerceImportExpense({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            productId,
            partnerId,
        });

        return await this.getCurrentBudget();
    }

    /**
     * Add export income (vente de produits vers l'extérieur)
     * @param {number} amount - Revenu total de l'export
     * @param {string} description - Description de l'export
     * @param {string} productId - ID du produit (wheat, carrot, etc.)
     * @returns {Promise<Object>} Updated budget
     */
    async addExportIncome(amount, description, productId = 'unknown', partnerId = null) {
        const budget = await this.getCurrentBudget();

        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid export income amount: ${amount}`);
            return budget;
        }

        const roundedAmount = Math.round(amount);
        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        await getOrCreateAccountingContext().recordCommerceExportIncome({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            productId,
            partnerId,
        });

        return await this.getCurrentBudget();
    }

    /**
     * Random event repair expense (journal + treasury).
     * @param {number} amount
     * @param {string} description
     */
    async addExceptionalExpense(amount, description) {
        const budget = await this.getCurrentBudget();
        const roundedAmount = Math.round(amount);

        if (roundedAmount <= 0) {
            return budget;
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        await getOrCreateAccountingContext().recordExceptionalExpense({
            turn: budget.turn,
            amount: roundedAmount,
            description,
        });

        return await this.getCurrentBudget();
    }

    /**
     * Commercial route opening fee (journal + treasury).
     * @param {number} amount
     * @param {string} description
     * @param {string} partnerId
     * @returns {Promise<{ budget: object, recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
     */
    async addCommercialRouteFee(amount, description, partnerId) {
        const budget = await this.getCurrentBudget();
        const roundedAmount = Math.round(amount);

        if (roundedAmount <= 0) {
            return {
                budget,
                recorded: false,
                skipped: true,
                treasuryApplied: false,
                reason: 'zero_amount',
            };
        }

        const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
        const result = await getOrCreateAccountingContext().recordCommercialRouteExpense({
            turn: budget.turn,
            amount: roundedAmount,
            description,
            partnerId,
        });

        return {
            budget: result.recorded ? await this.getCurrentBudget() : budget,
            recorded: result.recorded,
            skipped: result.skipped,
            treasuryApplied: result.treasuryApplied,
            reason: result.reason,
        };
    }

    /**
     * Add daily income (taxes, sales, etc.)
     * @param {number} amount - Daily income amount
     * @param {string} source - Source of income
     */
    async addDailyIncome(amount, source = "daily_income") {
        const budget = await this.getCurrentBudget();
        
        // Validate input amount
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid daily income amount: ${amount} (type: ${typeof amount})`);
            return budget; // Return current budget without changes
        }
        
        // Use budget values directly (they should be valid now)
        const currentFunds = budget.funds;
        const currentIncome = budget.income;
        const currentDailyIncome = budget.dailyIncome;
        
        budget.funds = currentFunds + amount;
        budget.income = currentIncome + amount;
        const roundedAmount = Math.round(amount);
        budget.funds = Math.round(budget.funds + roundedAmount);
        budget.income = Math.round(budget.income + roundedAmount);
        budget.dailyIncome = Math.round(currentDailyIncome + roundedAmount);
        budget.netFlow = Math.round(budget.income - budget.expenses);
        
        await this.db.budget.put(budget);
        return budget;
    }


    /**
     * Add building maintenance expenses only
     * @param {number} amount - Building maintenance cost
     * @param {string} description - Optional custom description (default: 'Maintenance bâtiments')
     */
    async addBuildingMaintenance(amount, description = 'Maintenance bâtiments', turn = null) {
        const budget = await this.getCurrentBudget();
        const effectiveTurn = turn ?? budget.turn;
        
        // Validate input amount
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid building maintenance amount: ${amount}`);
            return budget;
        }
        
        if (amount > 0) {
            const houses = await this.db.houses.toArray();
            const maintenanceBreakdown = {
                'houses': 0,
                'farms': 0,
                'markets': 0,
                'roads': 0,
                'infrastructure': 0,
                'industry': 0,
                total: 0
            };
            
            const maintenanceCosts = {
                'roads': 2,
                'House-Blue': 3,
                'House-Red': 3,
                'House-Purple': 3,
                'House-2Story': 3,
                'Farm': 1,
                'Market': 1
            };
            
            houses.forEach(house => {
                if (!house.type) return;
                
                const type = house.type;
                let cost = 2;
                
                if (type.includes('roads')) {
                    cost = maintenanceCosts['roads'];
                    maintenanceBreakdown.roads += cost;
                } else if (type === 'House-Blue' || type === 'House-Red' || type === 'House-Purple' || type === 'House-2Story' || type.includes('House')) {
                    cost = maintenanceCosts['House-Blue'];
                    maintenanceBreakdown.houses += cost;
                } else if (type.includes('Farm')) {
                    cost = maintenanceCosts['Farm'];
                    maintenanceBreakdown.farms += cost;
                } else if (type.includes('Market')) {
                    cost = maintenanceCosts['Market'];
                    maintenanceBreakdown.markets += cost;
                } else if (type.includes('Well') || type.includes('Fountain') || type.includes('Streetlight')) {
                    cost = 2;
                    maintenanceBreakdown.infrastructure += cost;
                } else if (type.includes('Windmill') || type.includes('Barn')) {
                    cost = 2;
                    maintenanceBreakdown.industry += cost;
                }
                
                maintenanceBreakdown.total += cost;
            });

            const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
            await getOrCreateAccountingContext().recordMaintenanceExpense({
                turn: effectiveTurn,
                amount,
                description,
                maintenanceBreakdown,
            });

            return await this.getCurrentBudget();
        }
        
        return budget;
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
        const budget = await this.getCurrentBudget();
        const effectiveTurn = turn ?? budget.turn;
        
        // Validate inputs
        if (typeof salaryPerMonth !== 'number' || isNaN(salaryPerMonth) || !isFinite(salaryPerMonth) || salaryPerMonth < 0) {
            console.error(`Invalid salary per month: ${salaryPerMonth}`);
            return budget;
        }
        
        if (typeof population !== 'number' || isNaN(population) || !isFinite(population) || population < 0) {
            console.error(`Invalid population: ${population}`);
            return budget;
        }
        
        // Calculate total salary expense
        const totalSalary = Math.round(salaryPerMonth * population);
        
        if (totalSalary > 0) {
            const salaryDescription = description || `Salaires fonctionnaires (${population} hab. × ${salaryPerMonth}€)`;

            const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
            await getOrCreateAccountingContext().recordSalaryExpense({
                turn: effectiveTurn,
                amount: totalSalary,
                description: salaryDescription,
            });

            return await this.getCurrentBudget();
        }
        
        return budget;
    }

    async addSalaryTax(salaryAmount, taxRate, description = null, turn = null) {
        const budget = await this.getCurrentBudget();
        const effectiveTurn = turn ?? budget.turn;
        
        if (typeof salaryAmount !== 'number' || isNaN(salaryAmount) || !isFinite(salaryAmount) || salaryAmount < 0) {
            return budget;
        }
        
        if (typeof taxRate !== 'number' || isNaN(taxRate) || !isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
            return budget;
        }
        
        const taxAmount = Math.round(salaryAmount * taxRate);
        
        if (taxAmount > 0) {
            const taxDescription = description || `Impôt sur les salaires (${Math.round(taxRate * 100)}%)`;

            const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
            await getOrCreateAccountingContext().recordPayrollTaxIncome({
                turn: effectiveTurn,
                amount: taxAmount,
                description: taxDescription,
            });

            return await this.getCurrentBudget();
        }
        
        return budget;
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
        // Import TimeManager to check current month
        const { TimeManager } = await import('../game/utils/TimeManager.js');
        const timeInfo = TimeManager.getTimeInfo(time);
        const isNovember = timeInfo.monthIndex === 10; // November is month index 10 (0-indexed: Jan=0, Feb=1, ..., Nov=10)
        
        // Only collect taxes in November
        if (!isNovember) {
            return await this.getCurrentBudget();
        }
        
        // Check if taxes have already been collected for this year
        const budget = await this.getCurrentBudget();
        const lastTaxYear = budget.lastTaxYear ?? -1; // Year when taxes were last collected
        
        // Only collect taxes once per year (first time we enter November)
        if (timeInfo.year === lastTaxYear) {
            return budget; // Taxes already collected this year
        }
        
        // Get all houses from the database
        const houses = await this.db.houses.toArray();
        
        // Calculate taxes per house type
        const taxBreakdown = {
            'House-Blue': 0,
            'House-Red': 0,
            'House-Purple': 0,
            total: 0,
            population: 0
        };
        
        houses.forEach(house => {
            if (house.type && (house.type.includes('House-Blue') || house.type.includes('House-Red') || house.type.includes('House-Purple'))) {
                const pop = house.pop || 0;
                
                // Only collect taxes if there is population
                if (pop > 0) {
                    // Get citizen tax amount from finances section manager (default: 100€)
                    // Support both window (browser) and global (Node/Jest)
                    const globalObj = typeof window !== 'undefined' ? window : global;
                    let citizenTaxAmount = 100;
                    if (globalObj.financesSectionManager && typeof globalObj.financesSectionManager.citizenTaxAmount === 'number') {
                        citizenTaxAmount = globalObj.financesSectionManager.citizenTaxAmount;
                    }
                    const taxPerHouse = Math.round(pop * citizenTaxAmount);
                    
                    if (house.type.includes('House-Blue')) {
                        taxBreakdown['House-Blue'] = Math.round(taxBreakdown['House-Blue'] + taxPerHouse);
                    } else if (house.type.includes('House-Red')) {
                        taxBreakdown['House-Red'] = Math.round(taxBreakdown['House-Red'] + taxPerHouse);
                    } else if (house.type.includes('House-Purple')) {
                        taxBreakdown['House-Purple'] = Math.round(taxBreakdown['House-Purple'] + taxPerHouse);
                    }
                    
                    taxBreakdown.total = Math.round(taxBreakdown.total + taxPerHouse);
                    taxBreakdown.population += pop;
                }
            }
        });
        
        // Only add taxes if there is population
        if (taxBreakdown.total > 0 && taxBreakdown.population > 0) {
            const roundedTotal = Math.round(taxBreakdown.total);
            const description = `Impôt Citoyen (${taxBreakdown.population} hab.) - Novembre`;

            const { getOrCreateAccountingContext } = await import('../acl/accounting.js');
            await getOrCreateAccountingContext().recordCitizenTaxIncome({
                turn: budget.turn,
                amount: roundedTotal,
                description,
                taxYear: timeInfo.year,
                taxBreakdown,
            });

            return await this.getCurrentBudget();
        }
        
        return budget;
    }

    /**
     * Get detailed income breakdown
     * @returns {Promise<Object>} Income breakdown with taxes and other sources
     */
    async getIncomeBreakdown() {
        const budget = await this.getCurrentBudget();
        
        return {
            totalIncome: budget.income || 0,
            dailyIncome: budget.dailyIncome || 0,
            taxes: budget.totalTaxes || 0, // Total taxes collected over all turns
            otherIncome: (budget.income || 0) - (budget.totalTaxes || 0) // Other income sources
        };
    }

    /**
     * Get detailed expense breakdown
     * @returns {Promise<Object>} Expense breakdown with different categories
     */
    async getExpenseBreakdown() {
        const budget = await this.getCurrentBudget();
        
        return {
            totalExpenses: budget.expenses || 0,
            dailyExpenses: budget.dailyExpenses || 0,
            buildingMaintenance: budget.totalBuildingMaintenance || 0,
            investments: budget.totalInvestments || 0
        };
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

    /**
     * Save budget state snapshot (called every 3 turns)
     * @param {number} turn - Current turn number
     * @param {Object} additionalData - Additional data (population, building counts, etc.)
     */
    async saveBudgetState(turn, additionalData = {}) {
        const budget = await this.getCurrentBudget();
        const financialHealth = await this.getFinancialHealth();
        
        const budgetState = {
            name: `budget_turn_${turn}`,
            turn: turn,
            date: new Date().toISOString(),
            funds: budget.funds,
            income: budget.income,
            expenses: budget.expenses,
            netFlow: budget.netFlow,
            dailyIncome: budget.dailyIncome,
            dailyExpenses: budget.dailyExpenses,
            totalTaxes: budget.totalTaxes,
            totalBuildingMaintenance: budget.totalBuildingMaintenance,
            totalInvestments: budget.totalInvestments,
            totalLoanInterestExpenses: budget.totalLoanInterestExpenses || 0,
            totalLoanRepayments: budget.totalLoanRepayments || 0,
            taxBreakdown: budget.taxBreakdown || null,
            maintenanceBreakdown: budget.maintenanceBreakdown || null,
            population: additionalData.population || 0,
            buildingCounts: additionalData.buildingCounts || {},
            financialHealth: financialHealth
        };

        try {
            await this.db.budget.add(budgetState);
            return budgetState;
        } catch (err) {
            if (err.name === 'ConstraintError') {
                // Update existing state
                await this.db.budget.put(budgetState);
                return budgetState;
            } else {
                console.error('Error saving budget state:', err);
                throw err;
            }
        }
    }

    /**
     * Get budget states (all saved states)
     */
    async getBudgetStates() {
        const allBudgets = await this.db.budget.toArray();
        // Filter only budget states (not the main budget)
        const budgetStates = allBudgets.filter(budget => budget.name.startsWith('budget_turn_'))
                         .sort((a, b) => b.turn - a.turn);
        
        // Migrate existing budget states to include loan fields
        let needsMigration = false;
        for (const state of budgetStates) {
            if (state.totalLoanInterestExpenses === undefined) {
                state.totalLoanInterestExpenses = 0;
                needsMigration = true;
            }
            if (state.totalLoanRepayments === undefined) {
                state.totalLoanRepayments = 0;
                needsMigration = true;
            }
        }
        
        if (needsMigration) {
            for (const state of budgetStates) {
                await this.db.budget.put(state);
            }
        }
        
        // Recalculate expenses for existing states to include loan interest
        let needsRecalculation = false;
        for (const state of budgetStates) {
            const calculatedExpenses = (state.totalBuildingMaintenance || 0) + 
                                     (state.totalLoanInterestExpenses || 0) + 
                                     (state.totalLoanRepayments || 0);
            
            if (state.expenses !== calculatedExpenses && calculatedExpenses > 0) {
                state.expenses = calculatedExpenses;
                state.netFlow = (state.income || 0) - state.expenses;
                needsRecalculation = true;
            }
        }
        
        if (needsRecalculation) {
            for (const state of budgetStates) {
                await this.db.budget.put(state);
            }
        }
        
        return budgetStates;
    }

    /**
     * Get budget states every N turns
     * @param {number} n - Every N turns (default: 3)
     */
    async getBudgetStatesEveryNTurns(n = 3) {
        const allStates = await this.getBudgetStates();
        return allStates.filter(state => state.turn % n === 0);
    }

    /**
     * Get budget states for a specific period
     * @param {number} startTurn - Start turn
     * @param {number} endTurn - End turn
     */
    async getBudgetStatesForPeriod(startTurn, endTurn) {
        const allStates = await this.getBudgetStates();
        return allStates.filter(state => state.turn >= startTurn && state.turn <= endTurn);
    }

    /**
     * Get the last N batches of budget states (each batch contains states every M turns)
     * @param {number} nBatches - Number of batches to retrieve
     * @param {number} batchSize - Size of each batch (every M turns)
     * @returns {Promise<Array>} Last N batches of budget states
     */
    async getLastNBatches(nBatches, batchSize) {
        const allStates = await this.getBudgetStates();
        
        if (allStates.length === 0) {
            return [];
        }

        // Get states that are multiples of batchSize (every M turns)
        const batchStates = allStates.filter(state => state.turn % batchSize === 0);
        
        if (batchStates.length === 0) {
            return [];
        }

        // Sort by turn descending to get the most recent first
        batchStates.sort((a, b) => b.turn - a.turn);
        
        // Take the last N batches
        const lastNBatches = batchStates.slice(0, nBatches);
        
        // Sort by turn ascending for display
        lastNBatches.sort((a, b) => a.turn - b.turn);

        return lastNBatches;
    }

    /**
     * Clean up old budget states (keep only last N)
     * @param {number} keepLast - Number of states to keep (default: 10)
     */
    async cleanupOldBudgetStates(keepLast = 10) {
        const allStates = await this.getBudgetStates();
        if (allStates.length > keepLast) {
            const statesToDelete = allStates.slice(keepLast);
            for (const state of statesToDelete) {
                await this.db.budget.delete(state.name);
            }
        }
    }

    /**
     * Clean up budget states older than 60 days (approximately 20 periods of 3 turns)
     * @returns {Promise<Object>} Cleanup result with count and message
     */
    async cleanupOldBudgetStatesByAge() {
        const allStates = await this.getBudgetStates();
        const currentTurn = await this.getCurrentTurn();
        
        // Calculate the cutoff turn (60 days ≈ 20 periods of 3 turns)
        const cutoffTurn = currentTurn - 60;
        
        // Find states older than 60 days
        const oldStates = allStates.filter(state => state.turn < cutoffTurn);
        
        if (oldStates.length === 0) {
            return {
                deleted: 0,
                message: 'Aucun état ancien à supprimer'
            };
        }

        // Delete old states
        for (const state of oldStates) {
            await this.db.budget.delete(state.name);
        }

        const message = `🧹 Nettoyage automatique : ${oldStates.length} état(s) de plus de 60 jours supprimé(s) (tours < ${cutoffTurn})`;

        return {
            deleted: oldStates.length,
            message: message,
            deletedTurns: oldStates.map(s => s.turn).sort((a, b) => a - b)
        };
    }

    /**
     * Get current turn from game store
     * @returns {Promise<number>} Current turn number
     */
    async getCurrentTurn() {
        try {
            if (window.gameStore) {
                const turnData = await window.gameStore.getLatestGameItemByField('turn');
                return turnData || 0;
            }
            return 0;
        } catch (error) {
            console.warn('Could not get current turn:', error);
            return 0;
        }
    }
}

const budgetManager = new BudgetManager();

// Make it globally available for debugging
if (typeof window !== 'undefined') {
    window.budgetManager = budgetManager;
    // Also register with AppRegistry if available
    if (window.app && window.app.register) {
        window.app.register('budgetManager', budgetManager);
    }
}

// Export both the class (for testing) and the singleton instance (for production)
export { BudgetManager };
export default budgetManager;
