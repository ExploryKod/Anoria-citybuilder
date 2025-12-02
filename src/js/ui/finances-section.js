class FinancesSectionManager {
    constructor(budgetManager) {
        this.budgetManager = budgetManager;
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
        if (!this.budgetManager) {
            this.renderStaticData();
            return;
        }

        try {
            const currentBudget = await this.budgetManager.getCurrentBudget();
            const budgetStates = await this.budgetManager.getBudgetStates();
            
            this.financialData = this.processFinancialData(currentBudget, budgetStates);
            this.render();
        } catch (error) {
            console.error('Error loading financial data:', error);
            this.renderStaticData();
        }
    }

    processFinancialData(currentBudget, budgetStates) {
        const thisYear = this.calculateThisYearData(currentBudget);
        const lastYear = this.calculateLastYearData(budgetStates);

        return {
            thisYear,
            lastYear,
            debt: currentBudget.funds < 0 ? Math.abs(currentBudget.funds) : 0,
            taxRate: this.taxRate,
            taxEstimate: this.calculateTaxEstimate(this.taxRate),
            message: this.generateFinancialMessage(thisYear, lastYear)
        };
    }

    calculateThisYearData(budget) {
        return {
            incomeTax: budget.totalTaxes || 0,
            vat: 0,
            tradeTax: 0,
            gifts: 0,
            interestIncome: 0,
            totalIncome: budget.income || 0,
            salaries: budget.totalBuildingMaintenance || 0,
            imports: 0,
            giftsGiven: 0,
            interestExpense: budget.totalLoanInterestExpenses || 0,
            maintenance: 0,
            construction: budget.totalInvestments || 0,
            totalExpenses: budget.expenses || 0,
            netFlow: budget.netFlow || 0,
            balance: budget.funds || 0
        };
    }

    calculateLastYearData(budgetStates) {
        if (!budgetStates || budgetStates.length === 0) {
            return this.getDefaultLastYearData();
        }

        const lastYearState = budgetStates[budgetStates.length - 1];
        return {
            incomeTax: lastYearState.totalTaxes || 137,
            vat: 0,
            tradeTax: 0,
            gifts: lastYearState.totalTaxes > 100 ? 1500 : 0,
            interestIncome: 0,
            totalIncome: lastYearState.income || 1637,
            salaries: lastYearState.totalBuildingMaintenance || 320,
            imports: 0,
            giftsGiven: 0,
            interestExpense: lastYearState.totalLoanInterestExpenses || 0,
            maintenance: 0,
            construction: lastYearState.totalInvestments || 2756,
            totalExpenses: lastYearState.expenses || 3436,
            netFlow: lastYearState.netFlow || -1799,
            balance: lastYearState.funds || 1217
        };
    }

    getDefaultLastYearData() {
        return {
            incomeTax: 137,
            vat: 0,
            tradeTax: 0,
            gifts: 1500,
            interestIncome: 0,
            totalIncome: 1637,
            salaries: 320,
            imports: 0,
            giftsGiven: 0,
            interestExpense: 0,
            maintenance: 0,
            construction: 2756,
            totalExpenses: 3436,
            netFlow: -1799,
            balance: 1217
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

        if (thisYear.netFlow < 0) {
            return {
                text: 'Le flux net est négatif. Surveillez vos dépenses.',
                type: 'warning'
            };
        }

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
            thisYear: {
                incomeTax: 63,
                vat: 0,
                tradeTax: 0,
                gifts: 0,
                interestIncome: 0,
                totalIncome: 63,
                salaries: 116,
                imports: 0,
                giftsGiven: 0,
                interestExpense: 1,
                maintenance: 0,
                construction: 1352,
                totalExpenses: 1559,
                netFlow: -1496,
                balance: -279
            },
            lastYear: this.getDefaultLastYearData(),
            debt: 279,
            taxRate: 7,
            taxEstimate: 234,
            message: {
                text: 'Analyse financière : La ville fonctionne avec un déficit cette année. Il est recommandé d\'augmenter les revenus ou de réduire les dépenses.',
                type: 'danger'
            }
        };

        this.financialData = staticData;
        this.render();
    }

    updateTableData(thisYear, lastYear) {
        const fields = [
            { key: 'incomeTax', thisYear: 'incomeTaxThisYear', lastYear: 'incomeTaxLastYear' },
            { key: 'vat', thisYear: 'vatThisYear', lastYear: 'vatLastYear' },
            { key: 'tradeTax', thisYear: 'tradeTaxThisYear', lastYear: 'tradeTaxLastYear' },
            { key: 'gifts', thisYear: 'giftsThisYear', lastYear: 'giftsLastYear' },
            { key: 'interestIncome', thisYear: 'interestIncomeThisYear', lastYear: 'interestIncomeLastYear' },
            { key: 'totalIncome', thisYear: 'totalIncomeThisYear', lastYear: 'totalIncomeLastYear' },
            { key: 'salaries', thisYear: 'salariesThisYear', lastYear: 'salariesLastYear' },
            { key: 'imports', thisYear: 'importsThisYear', lastYear: 'importsLastYear' },
            { key: 'giftsGiven', thisYear: 'giftsGivenThisYear', lastYear: 'giftsGivenLastYear' },
            { key: 'interestExpense', thisYear: 'interestExpenseThisYear', lastYear: 'interestExpenseLastYear' },
            { key: 'maintenance', thisYear: 'maintenanceThisYear', lastYear: 'maintenanceLastYear' },
            { key: 'construction', thisYear: 'constructionThisYear', lastYear: 'constructionLastYear' },
            { key: 'totalExpenses', thisYear: 'totalExpensesThisYear', lastYear: 'totalExpensesLastYear' },
            { key: 'netFlow', thisYear: 'netFlowThisYear', lastYear: 'netFlowLastYear' },
            { key: 'balance', thisYear: 'balanceThisYear', lastYear: 'balanceLastYear' }
        ];

        fields.forEach(field => {
            this.updateField(field.thisYear, thisYear[field.key]);
            this.updateField(field.lastYear, lastYear[field.key]);
        });

        this.updateBalanceRow(thisYear.balance);
    }

    updateField(fieldId, value) {
        const element = document.querySelector(`[data-field="${fieldId}"]`);
        if (element) {
            const numValue = Math.round(value || 0);
            const isNegative = numValue < 0;
            const absValue = Math.abs(numValue);
            
            if (element.tagName === 'SPAN') {
                element.textContent = isNegative ? `-${absValue}` : absValue.toString();
                element.className = isNegative ? 'finances-value-negative' : 'finances-value-positive';
            } else {
                element.textContent = absValue.toString();
                element.className = isNegative ? 'finances-value-negative' : 'finances-value-positive';
            }
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

    const budgetManager = window.budgetManager || window.app?.budgetManager;
    const manager = new FinancesSectionManager(budgetManager);
    
    const observer = new MutationObserver(() => {
        if (financesSection.classList.contains('active')) {
            manager.init();
            observer.disconnect();
        }
    });

    observer.observe(financesSection, { attributes: true, attributeFilter: ['class'] });

    if (financesSection.classList.contains('active')) {
        manager.init();
        observer.disconnect();
    }

    window.financesSectionManager = manager;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFinancesSection);
} else {
    initFinancesSection();
}

