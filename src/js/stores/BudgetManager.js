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
        
        // Since database is cleared each page load, always create fresh budget
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
            totalInvestments: 0
        };
        
        await this.db.budget.add(initialBudget);
        console.log('Budget initialized with fresh data:', initialBudget);
        return initialBudget;
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
            isInDebt: budget.funds < 0
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
        
        let status = "healthy";
        let message = "Finances are in good shape";
        
        if (budget.funds < 0) {
            status = "critical";
            message = "City is bankrupt!";
        } else if (budget.funds < 100) {
            status = "warning";
            message = "Low funds - manage expenses carefully";
        } else if (budget.funds < 200) {
            status = "deficit";
            message = "Limited funds - watch spending";
        } else if (budget.funds > 500) {
            status = "excellent";
            message = "Strong financial position";
        }
        
        return {
            status,
            message,
            budget
        };
    }
}

const budgetManager = new BudgetManager();

// Make it globally available for debugging
if (typeof window !== 'undefined') {
    window.budgetManager = budgetManager;
}

export default budgetManager;
