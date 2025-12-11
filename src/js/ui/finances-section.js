class FinancesSectionManager {
    constructor() {
        this.journalManager = window.journalManager || window.app?.journalManager;
        this.citizenTaxAmount = this.loadCitizenTaxAmount();
        this.financialData = null;
    }

    loadCitizenTaxAmount() {
        try {
            const stored = localStorage.getItem('citizen_tax_amount');
            if (stored !== null) {
                const parsed = parseInt(stored, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('[FinancesSection] Error loading citizen tax amount from localStorage:', error);
        }
        return 100; // Default: 100€ per citizen
    }

    saveCitizenTaxAmount(amount) {
        try {
            localStorage.setItem('citizen_tax_amount', amount.toString());
        } catch (error) {
            console.warn('[FinancesSection] Error saving citizen tax amount to localStorage:', error);
        }
    }

    init() {
        this.setupEventListeners();
        this.loadFinancialData();
    }

    setupEventListeners() {
        const taxDecreaseBtn = document.getElementById('tax-decrease-btn');
        const taxIncreaseBtn = document.getElementById('tax-increase-btn');

        const handleTaxDecrease = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustCitizenTaxAmount(-10);
        };

        const handleTaxIncrease = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustCitizenTaxAmount(10);
        };

        if (taxDecreaseBtn) {
            taxDecreaseBtn.removeEventListener('click', this._handleTaxDecrease);
            this._handleTaxDecrease = handleTaxDecrease;
            taxDecreaseBtn.addEventListener('click', this._handleTaxDecrease);
        }

        if (taxIncreaseBtn) {
            taxIncreaseBtn.removeEventListener('click', this._handleTaxIncrease);
            this._handleTaxIncrease = handleTaxIncrease;
            taxIncreaseBtn.addEventListener('click', this._handleTaxIncrease);
        }
        
        this.updateTaxDisplay();
    }

    async loadFinancialData() {
        // Réattacher les event listeners au cas où le panneau vient d'être rendu
        this.setupEventListeners();
        
        // Vérifier que journalManager est disponible
        if (!this.journalManager) {
            // Essayer de récupérer depuis window
            this.journalManager = window.journalManager || window.app?.journalManager;
            
            if (!this.journalManager) {
                console.warn('[FinancesSection] JournalManager not available, using static data');
                this.renderStaticData();
                return;
            }
        }

        try {
            // Obtenir le tour actuel depuis le journal (dernière entrée)
            const allEntries = await this.journalManager.getJournalEntries();
            const currentTurn = allEntries.length > 0 ? allEntries[0].turn : 0;
            
            // Obtenir l'année actuelle depuis TimeManager
            let currentYear = 0;
            if (window.TimeManager) {
                const timeInfo = window.TimeManager.getTimeInfo(currentTurn);
                currentYear = timeInfo.year;
            }
            
            // Obtenir les données annuelles depuis le journal
            const yearlyData = await this.journalManager.getYearlyFinancialSummary();
            
            // IMPORTANT: Use budgetManager.getCurrentBudget().funds as source of truth for current balance
            // This ensures consistency with display-funds (info-box)
            // The journal is used for historical data, but current balance comes from budgetManager
            let currentBalance = 0;
            if (window.budgetManager) {
                const currentBudget = await window.budgetManager.getCurrentBudget();
                currentBalance = currentBudget.funds || 0;
            } else {
                // Fallback to journal calculation if budgetManager not available
                currentBalance = await this.journalManager.getCurrentBalance();
            }
            
            this.financialData = this.processFinancialData(currentBalance, yearlyData, currentYear);
            this.render();
        } catch (error) {
            console.error('[FinancesSection] Error loading financial data:', error);
            this.renderStaticData();
        }
    }

    processFinancialData(currentBalance, yearlyData, currentYear) {
        // Trouver les données de cette année et de l'année dernière
        const thisYearData = yearlyData.find(y => y.year === currentYear) || this.getEmptyYearData(currentYear);
        const lastYearData = yearlyData.find(y => y.year === currentYear - 1) || this.getEmptyYearData(currentYear - 1);
        
        // Pour l'année dernière, utiliser le netFlow (flux net de l'année)
        const lastYearBalance = lastYearData.netFlow !== undefined ? lastYearData.netFlow : 0;
        
        // IMPORTANT: Pour l'année en cours, utiliser le solde total actuel (currentBalance)
        // qui vient de budgetManager.getCurrentBudget().funds (source de vérité)
        // Cela garantit la cohérence avec display-funds (info-box)
        const thisYearBalance = currentBalance; // Solde total actuel, pas juste le flux net de l'année
        
        const thisYear = this.mapJournalDataToUI(thisYearData, thisYearBalance);
        const lastYear = this.mapJournalDataToUI(lastYearData, lastYearBalance);

        return {
            thisYear,
            lastYear,
            debt: currentBalance < 0 ? Math.abs(currentBalance) : 0,
            message: this.generateFinancialMessage(thisYear, lastYear)
        };
    }

    /**
     * Mappe les données du journal vers le format UI
     * @param {Object} yearData - Données annuelles du journal
     * @param {number} currentBalance - Solde actuel (calculé depuis le journal) ou 0 pour l'année dernière
     * @returns {Object} Données formatées pour l'UI
     */
    mapJournalDataToUI(yearData, currentBalance) {
        if (!yearData || !yearData.income || !yearData.expenses) {
            return this.getEmptyYearData(yearData?.year || 0);
        }

        // Extraire les montants par type depuis les entrées du journal
        const incomeEntries = yearData.income.entries || [];
        const expenseEntries = yearData.expenses.entries || [];

        // Revenus
        const initialFunds = incomeEntries
            .filter(e => e.type === 'capital_funds')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const incomeTax = incomeEntries
            .filter(e => e.type === 'citizen_tax')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const payrollTax = incomeEntries
            .filter(e => e.type === 'payroll_tax')
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Exports : regrouper tous les types export_* (export_wheat, export_carrot, etc.)
        const exports = incomeEntries
            .filter(e => e.type && e.type.startsWith('export_'))
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Report à nouveau en revenu (si positif)
        const carryForwardIncome = incomeEntries
            .filter(e => e.type === 'carry_forward')
            .reduce((sum, e) => sum + e.amount, 0);

        // Dépenses
        const construction = expenseEntries
            .filter(e => e.type === 'construction')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const maintenance = expenseEntries
            .filter(e => e.type === 'maintenance')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const salary = expenseEntries
            .filter(e => e.type === 'salary')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const repairs = expenseEntries
            .filter(e => e.type === 'exceptional_expenses')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const commercialRoutes = expenseEntries
            .filter(e => e.type === 'commercial_route')
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Imports : regrouper tous les types import_* (import_wheat, import_carrot, etc.)
        const imports = expenseEntries
            .filter(e => e.type && e.type.startsWith('import_'))
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Report à nouveau en dépense (si négatif)
        const carryForwardExpense = expenseEntries
            .filter(e => e.type === 'carry_forward')
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            initialFunds: Math.round(initialFunds),
            incomeTax: Math.round(incomeTax),
            payrollTax: Math.round(payrollTax),
            exports: Math.round(exports),
            carryForwardIncome: Math.round(carryForwardIncome),
            totalIncome: Math.round(yearData.income.total),
            construction: Math.round(construction),
            maintenance: Math.round(maintenance),
            salary: Math.round(salary),
            repairs: Math.round(repairs),
            commercialRoutes: Math.round(commercialRoutes),
            imports: Math.round(imports),
            carryForwardExpense: Math.round(carryForwardExpense),
            totalExpenses: Math.round(yearData.expenses.total),
            balance: Math.round(currentBalance)
        };
    }

    getEmptyYearData(year) {
        return {
            initialFunds: 0,
            incomeTax: 0,
            payrollTax: 0,
            exports: 0,
            carryForwardIncome: 0,
            totalIncome: 0,
            construction: 0,
            maintenance: 0,
            salary: 0,
            repairs: 0,
            commercialRoutes: 0,
            imports: 0,
            carryForwardExpense: 0,
            totalExpenses: 0,
            balance: 0
        };
    }


    generateFinancialMessage(thisYear, lastYear) {
        if (thisYear.balance < 0) {
            return {
                text: 'La ville fonctionne avec un déficit cette année. Il est recommandé d\'augmenter les revenus ou de réduire les dépenses.',
                type: 'danger'
            };
        }

        // Le solde (report à nouveau) reflète déjà le résultat de l'année précédente
        // On n'a pas besoin de calculer le netFlow séparément
        if (thisYear.balance > lastYear.balance) {
            return {
                text: 'La situation financière s\'améliore par rapport à l\'année dernière.',
                type: 'success'
            };
        }

        return {
            text: 'La situation financière est stable.',
            type: 'info'
        };
    }

    adjustCitizenTaxAmount(delta) {
        const newAmount = Math.max(0, Math.min(1000, this.citizenTaxAmount + delta));
        
        if (newAmount !== this.citizenTaxAmount) {
            this.citizenTaxAmount = newAmount;
            this.saveCitizenTaxAmount(newAmount);
            this.updateTaxDisplay();
        }
    }

    updateTaxDisplay() {
        const taxRateDisplay = document.getElementById('tax-rate-display');
        const taxEstimate = document.getElementById('tax-estimate');

        if (taxRateDisplay) {
            taxRateDisplay.textContent = this.citizenTaxAmount;
        }

        if (taxEstimate) {
            taxEstimate.textContent = `${this.citizenTaxAmount}€ par citoyen`;
        }
    }

    render() {
        if (!this.financialData) {
            this.renderStaticData();
            return;
        }

        this.updateTableData(this.financialData.thisYear, this.financialData.lastYear);
        this.updateDebtInfo(this.financialData.debt);
        this.updateMessage(this.financialData.message);
        this.updateTaxDisplay();
    }

    renderStaticData() {
        const staticData = {
            thisYear: this.getEmptyYearData(0),
            lastYear: this.getEmptyYearData(0),
            debt: 0,
            message: {
                text: 'La situation financière est stable.',
                type: 'info'
            }
        };

        this.financialData = staticData;
        this.render();
    }

    updateTableData(thisYear, lastYear) {
        // Revenus (toujours positifs)
        const incomeFields = [
            { key: 'initialFunds', thisYear: 'initialFundsThisYear', lastYear: 'initialFundsLastYear' },
            { key: 'incomeTax', thisYear: 'incomeTaxThisYear', lastYear: 'incomeTaxLastYear' },
            { key: 'payrollTax', thisYear: 'payrollTaxThisYear', lastYear: 'payrollTaxLastYear' },
            { key: 'exports', thisYear: 'exportsThisYear', lastYear: 'exportsLastYear' },
            { key: 'carryForwardIncome', thisYear: 'carryForwardIncomeThisYear', lastYear: 'carryForwardIncomeLastYear' },
            { key: 'totalIncome', thisYear: 'totalIncomeThisYear', lastYear: 'totalIncomeLastYear' }
        ];

        // Dépenses (toujours positives dans le journal, mais affichées en rouge)
        const expenseFields = [
            { key: 'construction', thisYear: 'constructionThisYear', lastYear: 'constructionLastYear' },
            { key: 'maintenance', thisYear: 'maintenanceThisYear', lastYear: 'maintenanceLastYear' },
            { key: 'salary', thisYear: 'salaryThisYear', lastYear: 'salaryLastYear' },
            { key: 'repairs', thisYear: 'repairsThisYear', lastYear: 'repairsLastYear' },
            { key: 'imports', thisYear: 'importsThisYear', lastYear: 'importsLastYear' },
            { key: 'carryForwardExpense', thisYear: 'carryForwardExpenseThisYear', lastYear: 'carryForwardExpenseLastYear' },
            { key: 'totalExpenses', thisYear: 'totalExpensesThisYear', lastYear: 'totalExpensesLastYear' }
        ];

        // Balance (peut être négative ou positive)
        const balanceFields = [
            { key: 'balance', thisYear: 'balanceThisYear', lastYear: 'balanceLastYear' }
        ];

        // Mettre à jour les revenus (toujours positifs)
        incomeFields.forEach(field => {
            this.updateField(field.thisYear, thisYear[field.key], 'income');
            this.updateField(field.lastYear, lastYear[field.key], 'income');
        });

        // Mettre à jour les dépenses (toujours positives dans le journal)
        expenseFields.forEach(field => {
            this.updateField(field.thisYear, thisYear[field.key], 'expense');
            this.updateField(field.lastYear, lastYear[field.key], 'expense');
        });

        // Mettre à jour la balance (peut être négative)
        balanceFields.forEach(field => {
            this.updateField(field.thisYear, thisYear[field.key], 'balance');
            this.updateField(field.lastYear, lastYear[field.key], 'balance');
        });

        this.updateBalanceRow(thisYear.balance);
    }

    updateField(fieldId, value, type = 'balance') {
        const element = document.querySelector(`[data-field="${fieldId}"]`);
        if (!element) {
            console.warn(`[FinancesSection] Element not found for field: ${fieldId}`);
            return;
        }
        
        const numValue = Math.round(value || 0);
        const absValue = Math.abs(numValue);
        
        // Mettre à jour le texte avec formatage français
        element.textContent = absValue.toLocaleString('fr-FR');
        
        // Mettre à jour les classes CSS selon le type
        if (type === 'balance') {
            // Pour la balance, la classe dépend du signe de la valeur
            const isNegative = numValue < 0;
            element.classList.remove('finances-value-positive', 'finances-value-negative');
            element.classList.add(isNegative ? 'finances-value-negative' : 'finances-value-positive');
        } else if (type === 'income') {
            // Pour les revenus, toujours positif (même si 0)
            element.classList.remove('finances-value-negative');
            element.classList.add('finances-value-positive');
        } else if (type === 'expense') {
            // Pour les dépenses, toujours négatif (affichage en rouge)
            element.classList.remove('finances-value-positive');
            element.classList.add('finances-value-negative');
        }
    }

    updateBalanceRow(balance) {
        const balanceRow = document.querySelector('[data-field="balanceThisYear"]')?.closest('tr');
        if (balanceRow) {
            balanceRow.classList.remove('negative');
            if (balance < 0) {
                balanceRow.classList.add('negative');
            }
        }
    }

    updateDebtInfo(debt) {
        const debtAmount = document.getElementById('finances-debt-amount');
        if (debtAmount) {
            debtAmount.textContent = Math.round(debt || 0);
        }
    }

    updateMessage(message) {
        const messageArea = document.getElementById('finances-message-area');
        const messageText = document.getElementById('finances-message-text');

        if (messageArea && messageText) {
            messageArea.className = `finances-message-area ${message.type || 'info'}`;
            messageText.textContent = message.text || '';
        }
    }
}

function initFinancesSection() {
    const financesSection = document.getElementById('admin-section-finances');
    if (!financesSection) return;

    const manager = new FinancesSectionManager();
    
    // Observer pour recharger les données à chaque fois que la section devient active
    const observer = new MutationObserver(() => {
        if (financesSection.classList.contains('active')) {
            // Recharger les données depuis le journal à chaque activation
            manager.loadFinancialData();
        }
    });

    observer.observe(financesSection, { attributes: true, attributeFilter: ['class'] });

    // Initialiser si déjà actif
    if (financesSection.classList.contains('active')) {
        manager.init();
    }

    window.financesSectionManager = manager;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFinancesSection);
} else {
    initFinancesSection();
}

