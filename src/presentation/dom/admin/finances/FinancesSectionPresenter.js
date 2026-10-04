import { renderCityLedger, renderCityLedgerMessage } from '../../compta/livret/CityLedgerPresenter.js';
import { listHamlets } from '../../../../core/persistence/hamlet/hamletSession.js';

const ALL_HAMLETS_VALUE = 'all';

export class FinancesSectionPresenter {
  /**
   * @param {{ accounting: object }} deps
   */
  constructor(deps) {
    this.accounting = deps.accounting;
    this.citizenTaxAmount = this.accounting?.getCitizenTaxPerCapita?.() ?? 0;
    this.financialData = null;
  }

  /** The hamlet chosen in the budget dropdown, or null for the whole city. */
  selectedHamletId() {
    const value = document.getElementById('finances-hamlet-filter').value;
    return value === ALL_HAMLETS_VALUE ? null : value;
  }

  async populateHamletFilter() {
    const select = document.getElementById('finances-hamlet-filter');
    const hamlets = await listHamlets();
    const previous = select.value;
    // Rebuilt only when the hamlets change: the board refreshes every turn, and a rebuilt list would close the menu.
    const expected = [ALL_HAMLETS_VALUE, ...hamlets.map((hamlet) => hamlet.id)];
    const current = [...select.options].map((option) => option.value);
    if (current.length !== expected.length || current.some((value, index) => value !== expected[index])) {
      select.replaceChildren(
        new Option('Tous les hameaux', ALL_HAMLETS_VALUE),
        ...hamlets.map((hamlet) => new Option(hamlet.name, hamlet.id))
      );
    }
    select.value = hamlets.some((hamlet) => hamlet.id === previous) ? previous : ALL_HAMLETS_VALUE;

    if (!this._hamletFilterBound) {
      select.addEventListener('change', () => this.loadFinancialData());
      this._hamletFilterBound = true;
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
    // Loads can overlap (a turn while the hamlet changes): only the latest one may render.
    const load = (this._latestLoad = (this._latestLoad ?? 0) + 1);
    this.showLoading();

    await this.populateHamletFilter();

    try {
      const financialData = await this.accounting.getCityLedgerYearComparison({
        hamletId: this.selectedHamletId(),
      });
      if (load !== this._latestLoad) return;
      this.financialData = financialData;
      this.render();
    } catch (error) {
      console.error('[FinancesSection] Error loading financial data:', error);
      this.showError(`Budget indisponible : ${error.message}`);
      throw error;
    }
  }

  /** Until the journal is read, no figure is shown: each one reads "…", never a stale or a zero value. */
  showLoading() {
    for (const cell of document.querySelectorAll('#finances-board [data-field]')) {
      cell.textContent = '…';
    }
    renderCityLedgerMessage({ text: 'Chargement du budget…', type: 'info' });
  }

  /** Loud, visible error in the budget panel itself (the table is left untouched, never blanked to zeros). */
  showError(text) {
    renderCityLedgerMessage({ text, type: 'danger' });
  }


  getEmptyYearData(year) {
    return this.accounting.createEmptyCityLedgerYearLines(year);
  }

  adjustCitizenTaxAmount(delta) {
    const newAmount = Math.max(0, Math.min(1000, this.citizenTaxAmount + delta));

    if (newAmount !== this.citizenTaxAmount) {
      this.citizenTaxAmount = this.accounting.setCitizenTaxPerCapita(newAmount);
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
