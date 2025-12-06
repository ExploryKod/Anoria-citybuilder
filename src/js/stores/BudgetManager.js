import db from './db.js';
import config from '../game/config.js';
import journalManager from './JournalManager.js';

/**
 * BudgetManager - Handles all budget operations with proper financial terminology
 * Funds: Available money
 * Expenses: Money spent (previously called "debt")
 * Net Flow: Income - Expenses (positive = profit, negative = loss)
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
        // Use config value as default if not provided
        if (startingFunds === null) {
            startingFunds = config?.budget?.initialFunds || 200;
        }
        
        // Safe access to import.meta.env (doesn't exist in Node.js/Jest)
        const envValue = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_INITIAL_FUNDS 
            : undefined;
        
        console.log('[BudgetManager] initialize called with:', {
            provided: startingFunds,
            fromConfig: config?.budget?.initialFunds,
            envValue: envValue
        });
        
        // Clear any existing budget data to ensure fresh start
        await this.db.budget.clear();
        
        // Create fresh budget
        const initialBudget = {
            name: 'budget_current',
            funds: startingFunds,
            initialFunds: startingFunds, // Store initial funds separately for capital social
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
            
        return initialBudget;
    }

    /**
     * Calculate loan totals from budget loans array
     * Only recalculates current loan debt, NOT the already-paid interest/repayment totals
     * @param {Object} budget - Budget object
     */
    async calculateLoanTotals(budget) {
        if (!budget.loans || !Array.isArray(budget.loans)) {
            budget.loans = [];
            budget.loanDebt = 0;
            // Don't reset totalLoanInterest, totalLoanRepayments, totalLoanInterestExpenses
            // These are cumulative values that should persist
            if (budget.totalLoanInterest === undefined) budget.totalLoanInterest = 0;
            if (budget.totalLoanRepayments === undefined) budget.totalLoanRepayments = 0;
            if (budget.totalLoanInterestExpenses === undefined) budget.totalLoanInterestExpenses = 0;
            return;
        }
        
        let totalLoanDebt = 0;
        
        budget.loans.forEach(loan => {
            totalLoanDebt += loan.amount || 0;
        });
        
        budget.loanDebt = totalLoanDebt;
        
        // Ensure cumulative values are initialized if not exists
        if (budget.totalLoanInterest === undefined) budget.totalLoanInterest = 0;
        if (budget.totalLoanRepayments === undefined) budget.totalLoanRepayments = 0;
        if (budget.totalLoanInterestExpenses === undefined) budget.totalLoanInterestExpenses = 0;
               
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
        
        // Get expected initial funds from config (source of truth)
        const expectedInitialFunds = config?.budget?.initialFunds || 200;
        
        // Safe access to import.meta.env
        const envValue = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_INITIAL_FUNDS 
            : undefined;
     
        if (!budget) {
            // No budget exists - initialize with config value
            return await this.initialize(expectedInitialFunds);
        }
             
        // Check if initialFunds needs to be updated to match config
        // This ensures the budget always reflects the current config value
        let needsUpdate = false;
        if (budget.initialFunds !== expectedInitialFunds) {
            // Store old initialFunds before updating
            const oldInitialFunds = budget.initialFunds || 200;
            
            console.log('[BudgetManager] initialFunds mismatch detected. Updating from', oldInitialFunds, 'to', expectedInitialFunds);
            
            // Update initialFunds to match config
            budget.initialFunds = expectedInitialFunds;
            needsUpdate = true;
            
            // If this is a brand new budget (turn 0), update funds to match config
            // This handles the case where IndexedDB has old data but config changed
            // BUT only if no transactions have been made (income = 0 and expenses = 0)
            if (budget.turn === 0) {
                // Check if funds still match the old initialFunds (meaning it's a fresh start)
                // Use a small tolerance for floating point comparison
                const fundsMatchOldInitial = Math.abs(budget.funds - oldInitialFunds) < 1;
                // Only reset if no transactions have been made (truly fresh start)
                const noTransactions = (budget.income === 0 || budget.income === undefined) && 
                                      (budget.expenses === 0 || budget.expenses === undefined);
                
                if (fundsMatchOldInitial && noTransactions) {
                    // Funds haven't changed from initial AND no transactions - update to new initial funds
                    console.log('[BudgetManager] Updating funds from', budget.funds, 'to', expectedInitialFunds, '(fresh start detected, turn=0, no transactions)');
                    budget.funds = expectedInitialFunds;
                    needsUpdate = true;
                } else {
                    console.log('[BudgetManager] Funds do not match old initialFunds or transactions exist, keeping current funds:', budget.funds);
                }
            } else {
                console.log('[BudgetManager] Budget has turn > 0, not updating funds (game in progress)');
            }
        } else if (budget.turn === 0 && Math.abs(budget.funds - expectedInitialFunds) > 1) {
            // Even if initialFunds matches, if turn is 0 and funds don't match, update funds
            // BUT only if no transactions have been made
            const noTransactions = (budget.income === 0 || budget.income === undefined) && 
                                  (budget.expenses === 0 || budget.expenses === undefined);
            
            if (noTransactions) {
                console.log('[BudgetManager] Turn is 0 but funds don\'t match expected initial funds. Updating funds from', budget.funds, 'to', expectedInitialFunds, '(no transactions detected)');
                budget.funds = expectedInitialFunds;
                needsUpdate = true;
            } else {
                console.log('[BudgetManager] Turn is 0 but transactions exist, keeping current funds:', budget.funds);
            }
        }
        
        // Calculate loan totals from budget loans array
        await this.calculateLoanTotals(budget);
        
        // Migration: Add new fields if they don't exist
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
        if (budget.initialFunds === undefined) {
            budget.initialFunds = expectedInitialFunds;
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            await this.db.budget.put(budget);
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
        
        // Add journal entry
        await this.addJournalEntry(budget.turn, 'income', amount, source);
        
        budget.funds += amount;
        budget.income += amount;
        budget.netFlow = budget.income - budget.expenses;
        
        await this.db.budget.put(budget);

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

        return budget;
    }

    /**
     * Add loan interest expense to budget
     * @param {number} amount - Interest amount
     * @param {string} description - Description of interest
     */
    async addLoanInterest(amount, description = 'Loan Interest') {
        const budget = await this.getCurrentBudget();
        
        // Add journal entry
        await this.addJournalEntry(budget.turn, 'loan_interest', amount, description);
        
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

        return budget;
    }

    /**
     * Repay loan principal
     * @param {number} amount - Amount to repay
     * @param {string} description - Description of repayment
     */
    async repayLoan(amount, description = 'Loan Repayment', loanId = null) {
        const budget = await this.getCurrentBudget();
        
        // Add journal entry
        await this.addJournalEntry(budget.turn, 'loan_repayment', amount, description);
        
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
        
        // Allow negative funds (debt) - removed the insufficient funds check
        // The game can go into debt, which is a valid game state

        try {
            budget.funds = currentFunds - amount;
            
            // Add journal entry
            await this.addJournalEntry(budget.turn, 'expense', amount, reason);
            
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
     * @param {string} description - Optional custom description (default: 'Maintenance bâtiments')
     */
    async addBuildingMaintenance(amount, description = 'Maintenance bâtiments') {
        const budget = await this.getCurrentBudget();
        
        // Validate input amount
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            console.error(`Invalid building maintenance amount: ${amount}`);
            return budget;
        }
        
        if (amount > 0) {
            // Get building counts from houses in the database for detailed breakdown
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
            
            // Maintenance costs per building type (per month)
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
                let cost = 2; // Default cost
                
                if (type.includes('roads')) {
                    cost = maintenanceCosts['roads'];
                    maintenanceBreakdown.roads += cost;
                } else if (type === 'House-Blue' || type === 'House-Red' || type === 'House-Purple' || type === 'House-2Story' || type.includes('House')) {
                    cost = maintenanceCosts['House-Blue']; // All houses cost 3€
                    maintenanceBreakdown.houses += cost;
                } else if (type.includes('Farm')) {
                    cost = maintenanceCosts['Farm'];
                    maintenanceBreakdown.farms += cost;
                } else if (type.includes('Market')) {
                    cost = maintenanceCosts['Market'];
                    maintenanceBreakdown.markets += cost;
                } else if (type.includes('Well') || type.includes('Fountain') || type.includes('Streetlight')) {
                    cost = 2; // Infrastructure default
                    maintenanceBreakdown.infrastructure += cost;
                } else if (type.includes('Windmill') || type.includes('Barn')) {
                    cost = 2; // Industry default
                    maintenanceBreakdown.industry += cost;
                }
                
                maintenanceBreakdown.total += cost;
            });
            
            // Add journal entry with custom description
            await this.addJournalEntry(budget.turn, 'maintenance', amount, description);
            
            // Update budget
            budget.funds -= amount;
            budget.expenses += amount;
            budget.dailyExpenses += amount;
            
            // Update detailed tracking
            budget.totalBuildingMaintenance += amount;
            budget.netFlow = budget.income - budget.expenses;
            
            // Store maintenance breakdown for detailed display
            budget.maintenanceBreakdown = maintenanceBreakdown;
            
            await this.db.budget.put(budget);
        }
        
        return budget;
    }

    /**
     * Add taxes based on population (100€ per citizen per month, only in November)
     * Calculates taxes from houses in the database
     * Only collects taxes if there is population AND it's November (month index 10)
     * Taxes are collected only ONCE per year (first day of November)
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
                    const taxPerHouse = pop * 100; // 100€ per citizen in May
                    
                    if (house.type.includes('House-Blue')) {
                        taxBreakdown['House-Blue'] += taxPerHouse;
                    } else if (house.type.includes('House-Red')) {
                        taxBreakdown['House-Red'] += taxPerHouse;
                    } else if (house.type.includes('House-Purple')) {
                        taxBreakdown['House-Purple'] += taxPerHouse;
                    }
                    
                    taxBreakdown.total += taxPerHouse;
                    taxBreakdown.population += pop;
                }
            }
        });
        
        // Only add taxes if there is population
        if (taxBreakdown.total > 0 && taxBreakdown.population > 0) {
            // Add journal entry
            await this.addJournalEntry(budget.turn, 'income', taxBreakdown.total, `Impôts habitants (${taxBreakdown.population} hab.) - Novembre`);
            
            // Add to daily income
            budget.funds += taxBreakdown.total;
            budget.income += taxBreakdown.total;
            budget.dailyIncome += taxBreakdown.total;
            budget.totalTaxes += taxBreakdown.total; // Track total taxes collected
            
            // Store tax breakdown for detailed display
            budget.taxBreakdown = taxBreakdown;
            
            // Mark this year as having collected taxes
            budget.lastTaxYear = timeInfo.year;
            
            budget.netFlow = budget.income - budget.expenses;
            
            await this.db.budget.put(budget);
            console.log(`[BudgetManager] Taxes collected for year ${timeInfo.year}: ${taxBreakdown.total}€ from ${taxBreakdown.population} habitants`);
            return budget;
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
        // Use config value as default if not provided
        if (startingFunds === null) {
            startingFunds = config?.budget?.initialFunds || 200;
        }
        
        console.log('[BudgetManager] forceReinitialize called with:', {
            provided: startingFunds,
            fromConfig: config?.budget?.initialFunds,
            envValue: typeof import.meta !== 'undefined' && import.meta.env 
                ? import.meta.env.VITE_INITIAL_FUNDS 
                : undefined
        });
        
        await this.db.budget.clear();
        
        const result = await this.initialize(startingFunds);
        
        console.log('[BudgetManager] forceReinitialize completed, new budget:', result);
        
        return result;
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
