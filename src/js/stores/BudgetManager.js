import db from './db.js';

/**
 * BudgetManager - Handles all budget operations with proper financial terminology
 * Funds: Available money
 * Expenses: Money spent (previously called "debt")
 * Net Flow: Income - Expenses (positive = profit, negative = loss)
 */
class BudgetManager {
    constructor() {
        this.db = db;
    }

    /**
     * Initialize budget with starting funds
     * @param {number} startingFunds - Initial funds (default: 200)
     */
    async initialize(startingFunds = 200) {
        console.log('BudgetManager.initialize() called with startingFunds:', startingFunds);
        
        // Clear any existing budget data to ensure fresh start
        await this.db.budget.clear();
        console.log('Budget table cleared');
        
        // Create fresh budget
        const initialBudget = {
            name: 'budget_current',
            funds: startingFunds,
            expenses: 0,
            income: 0,
            netFlow: 0,
            turn: 0,
            dailyIncome: 0,
            dailyExpenses: 0,
            totalTaxes: 0,
            totalMaintenance: 0,
            totalSalaries: 0,
            totalBuildingMaintenance: 0,
            totalInvestments: 0,
            totalLoanInterestExpenses: 0, // Interest expenses as separate category
            // Loan-related fields
            loans: [], // Array of active loans
            loanDebt: 0,
            totalLoanInterest: 0,
            totalLoanRepayments: 0
        };
        
        await this.db.budget.add(initialBudget);
        console.log('Budget initialized with fresh data:', initialBudget);
        
        return initialBudget;
    }

    /**
     * Calculate loan totals from budget loans array
     * @param {Object} budget - Budget object
     */
    async calculateLoanTotals(budget) {
        if (!budget.loans || !Array.isArray(budget.loans)) {
            budget.loans = [];
            budget.loanDebt = 0;
            budget.totalLoanInterest = 0;
            budget.totalLoanRepayments = 0;
            budget.totalLoanInterestExpenses = 0;
            return;
        }
        
        let totalLoanDebt = 0;
        let totalLoanInterest = 0;
        let totalLoanRepayments = 0;
        let totalLoanInterestExpenses = 0;
        
        budget.loans.forEach(loan => {
            totalLoanDebt += loan.amount || 0;
            totalLoanInterest += loan.interest || 0;
            
            // Calculate total repayments based on remaining turns
            const paidTurns = (loan.duration || 0) - (loan.remainingTurns || 0);
            const monthlyPayment = Math.round((loan.total || 0) / (loan.duration || 1));
            totalLoanRepayments += monthlyPayment * paidTurns;
            
            // Calculate accrued interest (interest that should be paid but hasn't been paid yet)
            const accruedInterest = Math.round(loan.amount * (loan.interestRate / 100) / loan.duration);
            totalLoanInterestExpenses += accruedInterest;
        });
        
        budget.loanDebt = totalLoanDebt;
        budget.totalLoanInterest = totalLoanInterest;
        budget.totalLoanRepayments = totalLoanRepayments;
        budget.totalLoanInterestExpenses = totalLoanInterestExpenses;
        
        console.log('Loan totals calculated:', {
            debt: totalLoanDebt,
            interest: totalLoanInterest,
            repayments: totalLoanRepayments,
            interestExpenses: totalLoanInterestExpenses
        });
        
        // Save the updated budget
        await this.db.budget.put(budget);
    }

    /**
     * Get current budget state
     * @returns {Promise<Object>} Current budget data
     */
    async getCurrentBudget() {
        const budgetData = await this.db.budget.toArray();
        const budget = budgetData[0];
        
        if (!budget) {
            console.log('No budget found, initializing...');
            return await this.initialize();
        }
        
        // Calculate loan totals from budget loans array
        await this.calculateLoanTotals(budget);
        
        // Migration: Add new fields if they don't exist
        let needsUpdate = false;
        if (budget.totalTaxes === undefined) {
            budget.totalTaxes = 0;
            needsUpdate = true;
        }
        if (budget.totalMaintenance === undefined) {
            budget.totalMaintenance = 0;
            needsUpdate = true;
        }
        if (budget.totalSalaries === undefined) {
            budget.totalSalaries = 0;
            needsUpdate = true;
        }
        if (budget.totalBuildingMaintenance === undefined) {
            budget.totalBuildingMaintenance = 0;
            needsUpdate = true;
        }
        if (budget.totalInvestments === undefined) {
            budget.totalInvestments = 0;
            needsUpdate = true;
        }
        if (budget.totalLoanInterestExpenses === undefined) {
            budget.totalLoanInterestExpenses = 0;
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            await this.db.budget.put(budget);
            console.log('Migrated budget: added expense tracking fields');
        }
        
        return budget;
    }

    /**
     * Add income to funds
     * @param {number} amount - Income amount
     * @param {string} source - Source of income (e.g., "taxes", "sales")
     */
    async addIncome(amount, source = "unknown") {
        const budget = await this.getCurrentBudget();
        
        budget.funds += amount;
        budget.income += amount;
        budget.netFlow = budget.income - budget.expenses;
        
        await this.db.budget.put(budget);
        
        console.log(`Income added: +${amount}€ from ${source}. New funds: ${budget.funds}€`);
        return budget;
    }

    /**
     * Add loan to budget (principal amount)
     * @param {number} amount - Loan principal amount
     * @param {string} description - Description of loan
     */
    async addLoan(amount, description = 'Loan', loanData = null) {
        const budget = await this.getCurrentBudget();
        budget.funds += amount;
        
        // Initialize loans array if not exists
        if (!budget.loans) budget.loans = [];
        
        // Add loan to budget if loanData provided
        if (loanData) {
            budget.loans.push(loanData);
        }
        
        // Recalculate loan totals
        await this.calculateLoanTotals(budget);
        
        console.log(`Loan added: +${amount}€ (${description}). New funds: ${budget.funds}€, Loan debt: ${budget.loanDebt}€`);
        return budget;
    }

    /**
     * Add loan interest expense to budget
     * @param {number} amount - Interest amount
     * @param {string} description - Description of interest
     */
    async addLoanInterest(amount, description = 'Loan Interest') {
        const budget = await this.getCurrentBudget();
        budget.expenses += amount;
        budget.funds -= amount;
        budget.netFlow = budget.income - budget.expenses;
        
        // Initialize loan interest if not exists
        if (!budget.totalLoanInterest) budget.totalLoanInterest = 0;
        budget.totalLoanInterest += amount;
        
        // Initialize loan interest expenses if not exists
        if (!budget.totalLoanInterestExpenses) budget.totalLoanInterestExpenses = 0;
        budget.totalLoanInterestExpenses += amount;
        
        await this.db.budget.put(budget);
        
        console.log(`Loan interest added: -${amount}€ (${description}). New funds: ${budget.funds}€`);
        return budget;
    }

    /**
     * Repay loan principal
     * @param {number} amount - Amount to repay
     * @param {string} description - Description of repayment
     */
    async repayLoan(amount, description = 'Loan Repayment', loanId = null) {
        const budget = await this.getCurrentBudget();
        budget.funds -= amount;
        budget.expenses += amount;
        budget.netFlow = budget.income - budget.expenses;
        
        // Track total loan repayments
        if (!budget.totalLoanRepayments) budget.totalLoanRepayments = 0;
        budget.totalLoanRepayments += amount;
        
        // Update specific loan if loanId provided
        if (loanId && budget.loans) {
            const loan = budget.loans.find(l => l.id === loanId);
            if (loan) {
                loan.amount = Math.max(0, loan.amount - amount);
                loan.remainingTurns--;
                
                // Remove loan if fully paid
                if (loan.remainingTurns <= 0 || loan.amount <= 0) {
                    budget.loans = budget.loans.filter(l => l.id !== loanId);
                }
            }
        }
        
        // Recalculate loan totals
        await this.calculateLoanTotals(budget);
        
        await this.db.budget.put(budget);
        
        console.log(`Loan repaid: -${amount}€ (${description}). New funds: ${budget.funds}€, Remaining debt: ${budget.loanDebt}€`);
        return budget;
    }

    /**
     * Get active loans from budget
     * @returns {Promise<Array>} Array of active loans
     */
    async getActiveLoans() {
        const budget = await this.getCurrentBudget();
        return budget.loans || [];
    }

    /**
     * Add expense (spending money)
     * @param {number} amount - Expense amount
     * @param {string} reason - Reason for expense (e.g., "building", "maintenance")
     * @returns {Promise<Object>} Result object with success status
     */
    async addExpense(amount, reason = "unknown") {
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
        
        // Use budget values directly (they should be valid now)
        const currentFunds = budget.funds;
        const currentExpenses = budget.expenses;
        const currentIncome = budget.income;
        
        if (currentFunds < amount) {
            return {
                success: false,
                reason: 'insufficient_funds',
                message: `Not enough funds. Required: ${amount}€, Available: ${currentFunds}€`
            };
        }

        try {
            budget.funds = currentFunds - amount;
            
            // Distinguish between investments and regular expenses
            if (reason.includes('Building:') || reason.includes('building')) {
                // This is an investment (building purchase)
                budget.totalInvestments += amount;
                // Don't add to regular expenses for investments
            } else {
                // This is a regular expense
                budget.expenses = currentExpenses + amount;
            }
            
            budget.netFlow = currentIncome - budget.expenses;
            
            await this.db.budget.put(budget);
            
            console.log(`Expense added: -${amount}€ for ${reason}. Remaining funds: ${budget.funds}€`);
            return {
                success: true,
                budget: budget,
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
        const budget = await this.getCurrentBudget();
        budget.turn = turn;
        
        // Reset daily income/expenses but keep running totals
        budget.dailyIncome = 0;
        budget.dailyExpenses = 0;
        
        await this.db.budget.put(budget);
        return budget;
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
        budget.dailyIncome = currentDailyIncome + amount;
        budget.netFlow = budget.income - budget.expenses;
        
        await this.db.budget.put(budget);
        console.log(`Daily income added: +${amount}€ from ${source}. New funds: ${budget.funds}€`);
        return budget;
    }

    /**
     * Add daily expenses (maintenance, salaries, etc.)
     * @param {number} amount - Daily expense amount
     * @param {string} reason - Reason for expense
     */
    async addDailyExpense(amount, reason = "daily_expense") {
        const budget = await this.getCurrentBudget();
        
        // Validate input amount
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid daily expense amount: ${amount} (type: ${typeof amount})`);
            return budget; // Return current budget without changes
        }
        
        // Use budget values directly (they should be valid now)
        const currentFunds = budget.funds;
        const currentExpenses = budget.expenses;
        const currentIncome = budget.income;
        const currentDailyExpenses = budget.dailyExpenses;
        
        budget.funds = currentFunds - amount;
        budget.expenses = currentExpenses + amount;
        budget.dailyExpenses = currentDailyExpenses + amount;
        budget.netFlow = currentIncome - budget.expenses;
        
        await this.db.budget.put(budget);
        return budget;
    }


    /**
     * Add building maintenance expenses only
     * @param {number} amount - Building maintenance cost
     */
    async addBuildingMaintenance(amount) {
        const budget = await this.getCurrentBudget();
        
        // Validate input amount
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid building maintenance amount: ${amount}`);
            return budget;
        }
        
        if (amount > 0) {
            // Update budget
            budget.funds -= amount;
            budget.expenses += amount;
            budget.dailyExpenses += amount;
            
            // Update detailed tracking
            budget.totalBuildingMaintenance += amount;
            budget.netFlow = budget.income - budget.expenses;
            
            await this.db.budget.put(budget);
            console.log(`Building maintenance added: ${amount}€`);
        }
        
        return budget;
    }

    /**
     * Add taxes based on population (10€ per citizen per turn)
     * @param {number} population - Current population count
     * @returns {Promise<Object>} Updated budget
     */
    async addTaxes(population) {
        const taxRate = 10; // 10€ per citizen per turn
        const taxAmount = population * taxRate;
        
        if (taxAmount > 0) {
            const budget = await this.getCurrentBudget();
            
            // Add to daily income
            budget.funds += taxAmount;
            budget.income += taxAmount;
            budget.dailyIncome += taxAmount;
            budget.totalTaxes += taxAmount; // Track total taxes collected
            budget.netFlow = budget.income - budget.expenses;
            
            await this.db.budget.put(budget);
            console.log(`Taxes added: +${taxAmount}€ from ${population} citizens. Total taxes: ${budget.totalTaxes}€`);
            return budget;
        }
        
        return await this.getCurrentBudget();
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
     * @param {number} startingFunds - Starting funds amount
     */
    async forceReinitialize(startingFunds = 200) {
        console.log('Force reinitializing budget...');
        await this.db.budget.clear();
        
        return await this.initialize(startingFunds);
    }

    /**
     * Get financial health status
     * @returns {Promise<Object>} Financial health analysis
     */
    async getFinancialHealth() {
        const budget = await this.getCurrentBudget();
        
        // Calculate net flow (daily income - daily expenses)
        const netFlow = budget.dailyIncome - budget.dailyExpenses;
        
        let status = "healthy";
        let message = "Finances saines";
        
        // CRITICAL SITUATIONS (highest priority)
        if (budget.funds < 0) {
            status = "critical";
            message = "Faillite !";
        }
        // High deficit with low funds
        else if (netFlow < -30 && budget.funds < 100) {
            status = "critical";
            message = "Danger : dépenses excessives";
        }
        // Very high deficit regardless of funds
        else if (netFlow < -50) {
            status = "critical";
            message = "Déficit critique";
        }
        
        // WARNING SITUATIONS
        // Moderate deficit with low funds
        else if (netFlow < -20 && budget.funds < 100) {
            status = "warning";
            message = "Attention : déficit + fonds faibles";
        }
        // High deficit with sufficient funds
        else if (netFlow < -30 && budget.funds >= 100) {
            status = "warning";
            message = "Surveillez vos dépenses";
        }
        // Low funds with positive flow
        else if (budget.funds < 50 && netFlow >= 0) {
            status = "warning";
            message = "Fonds insuffisants";
        }
        
        // DEFICIT SITUATIONS
        // Small deficit with low funds
        else if (netFlow < 0 && budget.funds < 100) {
            status = "deficit";
            message = "Déficit + fonds limités";
        }
        // Small deficit with sufficient funds
        else if (netFlow < 0 && budget.funds >= 100) {
            status = "deficit";
            message = "Déficitaire";
        }
        // Low funds with small positive flow
        else if (budget.funds < 100 && netFlow >= 0 && netFlow < 20) {
            status = "deficit";
            message = "Fonds limités";
        }
        
        // EXCELLENT SITUATIONS
        // High positive flow
        else if (netFlow > 100) {
            status = "excellent";
            message = "Excellent flux";
        }
        // High funds with good flow
        else if (budget.funds > 500 && netFlow > 50) {
            status = "excellent";
            message = "Très solide";
        }
        // Very high funds
        else if (budget.funds > 1000) {
            status = "excellent";
            message = "Très prospère";
        }
        
        return {
            status,
            message,
            budget,
            netFlow
        };
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
            population: additionalData.population || 0,
            buildingCounts: additionalData.buildingCounts || {},
            financialHealth: financialHealth
        };

        try {
            await this.db.budget.add(budgetState);
            console.log(`📊 Budget state saved for turn ${turn}`);
            return budgetState;
        } catch (err) {
            if (err.name === 'ConstraintError') {
                // Update existing state
                await this.db.budget.put(budgetState);
                console.log(`📊 Budget state updated for turn ${turn}`);
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
        return allBudgets.filter(budget => budget.name.startsWith('budget_turn_'))
                         .sort((a, b) => b.turn - a.turn);
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
        
        console.log(`📊 Retrieved last ${nBatches} batches of ${batchSize}-turn periods:`, 
            lastNBatches.map(s => `Turn ${s.turn}`).join(', '));
        
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
            console.log(`🧹 Cleaned up ${statesToDelete.length} old budget states`);
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
        console.log(message);

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
}

export default budgetManager;
