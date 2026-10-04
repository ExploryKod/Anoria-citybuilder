import { getGoodCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { goodLabel } from '../../shell/CatalogVocabulary.js';
import { createSliderRow } from '../sliderRow.js';

/**
 * The Taxes tab: every tax the city collects, as one slider each. The citizen tax and the salary tax are the active
 * hamlet's (named in the header); customs are the city's (one rate, shown apart).
 */
export class TaxesSectionPresenter {
  /** @param {{ accounting: object }} deps */
  constructor({ accounting }) {
    this.accounting = accounting;
  }

  /** Reads every rate from its owner (the hamlet's row, the city's storage) and shows it. */
  async refresh() {
    const [citizenTax, salary, customsRate, vatRates] = await Promise.all([
      this.accounting.getCitizenTaxPerCapita(),
      this.accounting.getSalarySettings(),
      this.accounting.getCustomsRate(),
      this.accounting.getVatRates(),
    ]);
    this.#show('tax-citizen', citizenTax, '€');
    this.#show('tax-salary', Math.round(salary.salaryTaxRate * 100), '%');
    this.#show('tax-customs', Math.round(customsRate * 100), '%');
    this.#showVatRows(vatRates);
  }

  /** One VAT slider per good, built from the catalog: the goods a house buys are the goods the VAT reaches. */
  #showVatRows(vatRates) {
    const board = document.getElementById('vat-board');
    if (!board) throw new Error('[taxes] #vat-board is missing from the page');
    board.replaceChildren(
      ...getGoodCategories().map((good) =>
        createSliderRow({
          label: goodLabel(good),
          scope: 'Hameau',
          min: 0,
          max: 50,
          value: vatRates[good],
          unit: '%',
          ariaLabel: `TVA sur ${goodLabel(good)}, en pourcentage du prix HT`,
          dataset: { good },
          store: (value) => this.accounting.setVatRate(good, value),
        })
      )
    );
  }

  /** Binds the sliders once: a move shows the value, the release stores it. */
  bind() {
    this.#bindSlider('tax-citizen', '€', async (value) => {
      await this.accounting.setCitizenTaxPerCapita(value);
    });
    this.#bindSlider('tax-salary', '%', async (value) => {
      await this.accounting.setSalarySettings({ salaryTaxRate: value / 100 });
    });
    this.#bindSlider('tax-customs', '%', async (value) => {
      await this.accounting.setCustomsRate(value / 100);
    });
  }

  /** @param {string} prefix @param {number} value @param {string} unit */
  #show(prefix, value, unit) {
    const slider = document.getElementById(`${prefix}-slider`);
    const label = document.getElementById(`${prefix}-value`);
    if (!slider || !label) throw new Error(`[taxes] ${prefix} controls are missing from the page`);
    slider.value = String(value);
    label.textContent = `${value} ${unit}`;
  }

  /**
   * @param {string} prefix
   * @param {string} unit
   * @param {(value: number) => Promise<void>} store
   */
  #bindSlider(prefix, unit, store) {
    const slider = document.getElementById(`${prefix}-slider`);
    const label = document.getElementById(`${prefix}-value`);
    if (!slider || !label) throw new Error(`[taxes] ${prefix} controls are missing from the page`);
    slider.addEventListener('input', () => {
      label.textContent = `${slider.value} ${unit}`;
    });
    slider.addEventListener('change', () => {
      void store(Number(slider.value));
    });
  }
}
