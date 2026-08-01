import { getCityLedgerYearComparison, createEmptyCityLedgerYearLines } from '../acl/accounting.js';
import { renderCityLedger } from './budget/CityLedgerPresenter.js';
import { registerAppService } from '../acl/appRuntime.js';

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
        return 100;
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

        renderCityLedger(this.financialData);
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
                type: 'info',
            },
        };

        this.financialData = staticData;
        this.render();
    }
}

function initFinancesSection() {
    const financesSection = document.getElementById('admin-section-finances');
    if (!financesSection) return;

    const manager = new FinancesSectionManager();

    const observer = new MutationObserver(() => {
        if (financesSection.classList.contains('active')) {
            manager.loadFinancialData();
        }
    });

    observer.observe(financesSection, { attributes: true, attributeFilter: ['class'] });

    if (financesSection.classList.contains('active')) {
        manager.init();
    }

    registerAppService('financesSectionManager', manager);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFinancesSection);
} else {
    initFinancesSection();
}
