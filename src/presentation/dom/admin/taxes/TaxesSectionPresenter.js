import { getVatCategories, getVatCategoryLabel } from '../../../../shared/resource-catalog/VatCategoryCatalog.js';
import { createSliderRow } from '../sliderRow.js';

/**
 * The Taxes section, in two sub-tabs. "Impôts": the taxes the city collects, one slider each — the citizen tax and the
 * income tax are the active hamlet's, customs are the city's. "TVA": the value-added tax, one rate per VAT category,
 * with a uniform switch that puts every category at one general rate.
 */
export class TaxesSectionPresenter {
  /** @param {{ accounting: object }} deps */
  constructor({ accounting }) {
    this.accounting = accounting;
    this.bounds = accounting.getFiscalSliderBounds();
  }

  /** Reads every rate from its owner (the hamlet's row, the city's storage) and shows it. */
  async refresh() {
    const [citizenTax, salary, customsRate, vat] = await Promise.all([
      this.accounting.getCitizenTaxPerCapita(),
      this.accounting.getSalarySettings(),
      this.accounting.getCustomsRate(),
      this.accounting.getVatSettings(),
    ]);
    this.#show('tax-citizen', citizenTax, '€');
    this.#show('tax-salary', Math.round(salary.salaryTaxRate * 100), '%');
    this.#show('tax-customs', Math.round(customsRate * 100), '%');
    this.#showVat(vat);
  }

  /** Binds the sub-tabs and the sliders once: a move shows the value, the release stores it. */
  bind() {
    this.#bindSubTabs();
    this.#bindSlider('tax-citizen', '€', async (value) => {
      await this.accounting.setCitizenTaxPerCapita(value);
    });
    this.#bindSlider('tax-salary', '%', async (value) => {
      await this.accounting.setSalarySettings({ salaryTaxRate: value / 100 });
    });
    this.#bindSlider('tax-customs', '%', async (value) => {
      await this.accounting.setCustomsRate(value / 100);
    });

    this.#fit('tax-citizen', this.bounds.citizenTaxPerCapita);
    this.#fit('tax-salary', this.bounds.salaryTaxPercent);
    this.#fit('tax-customs', this.bounds.customsPercent);
    this.#fit('tax-vat-general', this.bounds.vatPercent);
    this.#bindSlider('tax-vat-general', '%', async (value) => {
      await this.accounting.setVatGeneralRate(value);
      await this.refresh();
    });
    const uniform = this.#checkbox('tax-vat-uniform');
    uniform.addEventListener('change', async () => {
      await this.accounting.setVatUniform(uniform.checked);
      await this.refresh();
    });
  }

  /** @param {{ uniform: boolean, generalRatePercent: number, categoryRatesPercent: Record<string, number> }} vat */
  #showVat({ uniform, generalRatePercent, categoryRatesPercent }) {
    this.#checkbox('tax-vat-uniform').checked = uniform;
    this.#show('tax-vat-general', generalRatePercent, '%');
    const board = document.getElementById('vat-board');
    if (!board) throw new Error('[taxes] #vat-board is missing from the page');
    board.replaceChildren(
      ...getVatCategories().map((category) => {
        const label = getVatCategoryLabel(category);
        const row = createSliderRow({
          label,
          scope: uniform ? 'Taux général' : 'Catégorie',
          min: this.bounds.vatPercent.min,
          max: this.bounds.vatPercent.max,
          value: categoryRatesPercent[category],
          unit: '%',
          ariaLabel: `TVA sur ${label}, en pourcentage du prix HT`,
          dataset: { vatCategory: category },
          store: (value) => this.accounting.setVatCategoryRate(category, value),
        });
        row.querySelector('input').disabled = uniform;
        return row;
      })
    );
  }

  #bindSubTabs() {
    for (const tab of document.querySelectorAll('[data-taxes-tab]')) {
      tab.addEventListener('click', () => this.#selectSubTab(tab.dataset.taxesTab));
    }
  }

  /** @param {string} name */
  #selectSubTab(name) {
    const panel = document.querySelector(`[data-taxes-panel="${name}"]`);
    if (!panel) throw new Error(`[taxes] the sub-tab "${name}" has no panel in the page`);
    for (const tab of document.querySelectorAll('[data-taxes-tab]')) {
      const selected = tab.dataset.taxesTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const other of document.querySelectorAll('[data-taxes-panel]')) {
      other.hidden = other.dataset.taxesPanel !== name;
    }
  }

  /** @param {string} prefix @param {{ min: number, max: number }} range the slider's range, from the catalog */
  #fit(prefix, range) {
    const slider = document.getElementById(`${prefix}-slider`);
    if (!slider) throw new Error(`[taxes] ${prefix}-slider is missing from the page`);
    slider.min = String(range.min);
    slider.max = String(range.max);
  }

  /** @param {string} id */
  #checkbox(id) {
    const box = document.getElementById(id);
    if (!box) throw new Error(`[taxes] #${id} is missing from the page`);
    return box;
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
