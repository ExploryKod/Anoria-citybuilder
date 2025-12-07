class FinancesSectionManager {
    constructor() {
        this.journalManager = window.journalManager || window.app?.journalManager;
        this.taxRate = 7;
        this.financialData = null;
    }

    init() {
        this.setupEventListeners();
        this.loadFinancialData();
    }

    setupEventListeners() {
        const taxDecreaseBtn = document.getElementById('tax-decrease-btn');
        const taxIncreaseBtn = document.getElementById('tax-increase-btn');

        if (taxDecreaseBtn) {
            taxDecreaseBtn.addEventListener('click', () => this.adjustTaxRate(-1));
        }

        if (taxIncreaseBtn) {
            taxIncreaseBtn.addEventListener('click', () => this.adjustTaxRate(1));
        }
    }

    async loadFinancialData() {
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
            
            // Le solde est déjà calculé dans yearlyData pour chaque année
            // Pour l'année en cours, on utilise getCurrentBalance() qui calcule depuis toutes les entrées
            const currentBalance = await this.journalManager.getCurrentBalance();
            
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
        
        // Pour chaque année, utiliser le solde de l'année (netFlow) calculé par le journal
        // Pour l'année en cours, on utilise le solde actuel (cumul depuis le début) car on est en cours d'année
        // Pour l'année dernière, on utilise le netFlow de l'année (solde de l'année)
        const thisYearBalance = currentBalance; // Solde actuel (cumul depuis le début du jeu)
        const lastYearBalance = lastYearData.netFlow !== undefined ? lastYearData.netFlow : 0; // Solde de l'année dernière (netFlow de l'année)
        
        const thisYear = this.mapJournalDataToUI(thisYearData, thisYearBalance);
        const lastYear = this.mapJournalDataToUI(lastYearData, lastYearBalance);

        return {
            thisYear,
            lastYear,
            debt: currentBalance < 0 ? Math.abs(currentBalance) : 0,
            taxRate: this.taxRate,
            taxEstimate: this.calculateTaxEstimate(this.taxRate),
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
            .filter(e => e.type === 'income')
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
        
        const repairs = expenseEntries
            .filter(e => e.type === 'exceptional_expenses')
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Report à nouveau en dépense (si négatif)
        const carryForwardExpense = expenseEntries
            .filter(e => e.type === 'carry_forward')
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            initialFunds: Math.round(initialFunds),
            incomeTax: Math.round(incomeTax),
            carryForwardIncome: Math.round(carryForwardIncome),
            totalIncome: Math.round(yearData.income.total),
            construction: Math.round(construction),
            maintenance: Math.round(maintenance),
            repairs: Math.round(repairs),
            carryForwardExpense: Math.round(carryForwardExpense),
            totalExpenses: Math.round(yearData.expenses.total),
            balance: Math.round(currentBalance)
        };
    }

    getEmptyYearData(year) {
        return {
            initialFunds: 0,
            incomeTax: 0,
            carryForwardIncome: 0,
            totalIncome: 0,
            construction: 0,
            maintenance: 0,
            repairs: 0,
            carryForwardExpense: 0,
            totalExpenses: 0,
            balance: 0
        };
    }


    calculateTaxEstimate(taxRate) {
        return Math.round(taxRate * 33.4);
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

    adjustTaxRate(delta) {
        const newRate = Math.max(0, Math.min(20, this.taxRate + delta));
        
        if (newRate !== this.taxRate) {
            this.taxRate = newRate;
            this.updateTaxDisplay();
        }
    }

    updateTaxDisplay() {
        const taxRateDisplay = document.getElementById('tax-rate-display');
        const taxEstimate = document.getElementById('tax-estimate');

        if (taxRateDisplay) {
            taxRateDisplay.textContent = `${this.taxRate}%`;
        }

        if (taxEstimate) {
            const estimate = this.calculateTaxEstimate(this.taxRate);
            taxEstimate.textContent = `rapporte environ ${estimate} Denarii`;
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
            taxRate: 7,
            taxEstimate: 234,
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
            { key: 'carryForwardIncome', thisYear: 'carryForwardIncomeThisYear', lastYear: 'carryForwardIncomeLastYear' },
            { key: 'totalIncome', thisYear: 'totalIncomeThisYear', lastYear: 'totalIncomeLastYear' }
        ];

        // Dépenses (toujours positives dans le journal, mais affichées en rouge)
        const expenseFields = [
            { key: 'construction', thisYear: 'constructionThisYear', lastYear: 'constructionLastYear' },
            { key: 'maintenance', thisYear: 'maintenanceThisYear', lastYear: 'maintenanceLastYear' },
            { key: 'repairs', thisYear: 'repairsThisYear', lastYear: 'repairsLastYear' },
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

