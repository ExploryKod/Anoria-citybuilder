import { getCityLedgerYearComparison } from '../acl/accounting.js';
import { createEmptyCityLedgerYearLines } from '../../contexts/accounting/domain/value-objects/CityLedgerYearLines.js';

class FinancesSectionManager {
    constructor() {
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
        this.setupEventListeners();

        try {
            this.financialData = await getCityLedgerYearComparison();
            this.render();
        } catch (error) {
            console.error('[FinancesSection] Error loading financial data:', error);
            this.renderStaticData();
        }
    }

    getEmptyYearData(year) {
        return createEmptyCityLedgerYearLines(year);
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

        this.updateTableData(this.financialData.thisYear, this.financialData.lastYear, this.financialData.twoYearsAgo);
        this.updateDebtInfo(this.financialData.debt);
        this.updateMessage(this.financialData.message);
        this.updateTaxDisplay();
    }

    renderStaticData() {
        const staticData = {
            thisYear: this.getEmptyYearData(0),
            lastYear: this.getEmptyYearData(0),
            twoYearsAgo: this.getEmptyYearData(0),
            debt: 0,
            message: {
                text: 'La situation financière est stable.',
                type: 'info'
            }
        };

        this.financialData = staticData;
        this.render();
    }

    updateTableData(thisYear, lastYear, twoYearsAgo) {
        // Revenus (toujours positifs) - SANS carry_forward dans la liste
        const incomeFields = [
            { key: 'initialFunds', thisYear: 'initialFundsThisYear', lastYear: 'initialFundsLastYear' },
            { key: 'incomeTax', thisYear: 'incomeTaxThisYear', lastYear: 'incomeTaxLastYear' },
            { key: 'payrollTax', thisYear: 'payrollTaxThisYear', lastYear: 'payrollTaxLastYear' },
            { key: 'exports', thisYear: 'exportsThisYear', lastYear: 'exportsLastYear' },
            { key: 'loanCapital', thisYear: 'loanCapitalThisYear', lastYear: 'loanCapitalLastYear' }
        ];

        // Dépenses (toujours positives dans le journal, mais affichées en rouge) - SANS carry_forward dans la liste
        const expenseFields = [
            { key: 'construction', thisYear: 'constructionThisYear', lastYear: 'constructionLastYear' },
            { key: 'maintenance', thisYear: 'maintenanceThisYear', lastYear: 'maintenanceLastYear' },
            { key: 'salary', thisYear: 'salaryThisYear', lastYear: 'salaryLastYear' },
            { key: 'repairs', thisYear: 'repairsThisYear', lastYear: 'repairsLastYear' },
            { key: 'imports', thisYear: 'importsThisYear', lastYear: 'importsLastYear' },
            { key: 'loanInterest', thisYear: 'loanInterestThisYear', lastYear: 'loanInterestLastYear' },
            { key: 'loanRepayment', thisYear: 'loanRepaymentThisYear', lastYear: 'loanRepaymentLastYear' }
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

        // Mettre à jour les totaux (sans carry_forward)
        this.updateField('totalIncomeThisYear', thisYear.totalIncome, 'income');
        this.updateField('totalIncomeLastYear', lastYear.totalIncome, 'income');
        this.updateField('totalExpensesThisYear', thisYear.totalExpenses, 'expense');
        this.updateField('totalExpensesLastYear', lastYear.totalExpenses, 'expense');

        // Calculer bénéfice/déficit n-1 (basé sur le solde de l'année dernière)
        // Le solde de l'année dernière est déjà calculé dans processFinancialData (lastYearBalance)
        const lastYearBalance = lastYear.balance || 0;
        
        // Bénéfice n-1 (positif) ou Déficit n-1 (négatif)
        const lastYearBenefit = lastYearBalance > 0 ? lastYearBalance : 0;
        const lastYearDeficit = lastYearBalance < 0 ? Math.abs(lastYearBalance) : 0;

        // Calculer bénéfice/déficit n-2 (basé sur le solde de l'année n-2)
        const twoYearsAgoBalance = (twoYearsAgo && twoYearsAgo.balance) ? twoYearsAgo.balance : 0;
        const twoYearsAgoBenefit = twoYearsAgoBalance > 0 ? twoYearsAgoBalance : 0;
        const twoYearsAgoDeficit = twoYearsAgoBalance < 0 ? Math.abs(twoYearsAgoBalance) : 0;

        // Mettre à jour bénéfice/déficit n-1
        if (lastYearBenefit > 0) {
            this.updateField('benefitLastYear', lastYearBenefit, 'income');
        } else {
            this.updateField('benefitLastYear', 0, 'income');
        }
        if (lastYearDeficit > 0) {
            this.updateField('deficitLastYear', lastYearDeficit, 'expense');
        } else {
            this.updateField('deficitLastYear', 0, 'expense');
        }

        // Calculer les totaux nets pour cette année (avec bénéfice/déficit n-1)
        const netIncome = thisYear.totalIncome + lastYearBenefit;
        const netExpenses = thisYear.totalExpenses + lastYearDeficit;
        
        // Calculer les totaux nets pour l'année dernière (avec bénéfice/déficit n-2)
        const lastYearNetIncome = lastYear.totalIncome + twoYearsAgoBenefit;
        const lastYearNetExpenses = lastYear.totalExpenses + twoYearsAgoDeficit;
        
        // Mettre à jour les totaux nets
        this.updateField('netIncomeThisYear', netIncome, 'income');
        this.updateField('netIncomeLastYear', lastYearNetIncome, 'income');
        this.updateField('netExpensesThisYear', netExpenses, 'expense');
        this.updateField('netExpensesLastYear', lastYearNetExpenses, 'expense');

        // Calculer le flux net de l'année dernière (Revenus nets - Dépenses nettes)
        const lastYearNetFlow = lastYearNetIncome - lastYearNetExpenses;
        this.updateField('netFlowLastYear', lastYearNetFlow, 'netflow');
        
        // Calculer le flux net de cette année (Revenus net - Dépenses net)
        const netFlow = netIncome - netExpenses;
        this.updateField('netFlowThisYear', netFlow, 'netflow');
        
        // Mettre à jour le label du flux net avec (déficit) ou (bénéfice) pour n-1 et n
        this.updateNetFlowLabel(netFlow, lastYearNetFlow);

        // Mettre à jour la balance (peut être négative)
        this.updateField('balanceThisYear', thisYear.balance, 'balance');
        this.updateField('balanceLastYear', lastYear.balance, 'balance');

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
        } else if (type === 'netflow') {
            // Pour le flux net, couleur bleue
            const isNegative = numValue < 0;
            element.classList.remove('finances-value-positive', 'finances-value-negative', 'finances-value-netflow');
            element.classList.add('finances-value-netflow');
            element.classList.add(isNegative ? 'finances-value-negative' : 'finances-value-positive');
        } else if (type === 'income') {
            // Pour les revenus, toujours positif (même si 0)
            element.classList.remove('finances-value-negative', 'finances-value-netflow');
            element.classList.add('finances-value-positive');
        } else if (type === 'expense') {
            // Pour les dépenses, toujours négatif (affichage en rouge)
            element.classList.remove('finances-value-positive', 'finances-value-netflow');
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

    updateNetFlowLabel(thisYearNetFlow, lastYearNetFlow) {
        const netFlowRow = document.querySelector('[data-field="netFlowThisYear"]')?.closest('tr');
        if (netFlowRow) {
            const labelCell = netFlowRow.querySelector('.finances-row-label');
            if (labelCell) {
                let labelText = 'Flux net';
                const suffixes = [];
                
                // Pour l'année dernière (n-1)
                if (lastYearNetFlow < 0) {
                    suffixes.push('n-1: déficit');
                } else if (lastYearNetFlow > 0) {
                    suffixes.push('n-1: bénéfice');
                }
                
                // Pour l'année en cours (n)
                if (thisYearNetFlow < 0) {
                    suffixes.push('n: déficit');
                } else if (thisYearNetFlow > 0) {
                    suffixes.push('n: bénéfice');
                }
                
                if (suffixes.length > 0) {
                    labelText += ' (' + suffixes.join(' | ') + ')';
                }
                
                labelCell.innerHTML = labelText + '<span class="finances-explanation">Revenus nets - Dépenses nettes</span>';
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

