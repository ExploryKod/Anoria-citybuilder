import { getCityLedgerYearComparison, createEmptyCityLedgerYearLines, getCitizenTaxPerCapita, setCitizenTaxPerCapita } from '../../../../composition/facades/accounting.js';
import { renderCityLedger } from '../../compta/livret/CityLedgerPresenter.js';

export class FinancesSectionPresenter {
    constructor() {
        this.citizenTaxAmount = getCitizenTaxPerCapita();
        this.financialData = null;
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
            this.citizenTaxAmount = setCitizenTaxPerCapita(newAmount);
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

