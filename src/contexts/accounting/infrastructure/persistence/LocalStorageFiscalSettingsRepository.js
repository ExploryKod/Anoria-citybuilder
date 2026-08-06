/**
 * localStorage adapter — citizen tax + civil servant salary settings.
 * Source of truth for ProcessTurnBudget / CollectCitizenTaxes (not UI presenters).
 */

export const FISCAL_STORAGE_KEYS = Object.freeze({
  citizenTaxPerCapita: 'citizen_tax_amount',
  salaryPerMonth: 'work_salary_per_month',
  salaryTaxRate: 'work_salary_tax_rate',
  unemploymentBenefitRate: 'work_unemployment_benefit_rate',
});

export const DEFAULT_FISCAL_SETTINGS = Object.freeze({
  citizenTaxPerCapita: 25,
  salaryPerMonth: 100,
  salaryTaxRate: 0.1,
  unemploymentBenefitRate: 0.7,
});

export class LocalStorageFiscalSettingsRepository {
  /**
   * @param {Storage|null} [storage]
   */
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
  }

  /** @returns {number} */
  getCitizenTaxPerCapita() {
    return this.#readNumber(
      FISCAL_STORAGE_KEYS.citizenTaxPerCapita,
      DEFAULT_FISCAL_SETTINGS.citizenTaxPerCapita,
      { min: 0, max: 1000, integer: true }
    );
  }

  /** @param {number} amount */
  setCitizenTaxPerCapita(amount) {
    const value = this.#clamp(amount, 0, 1000, true);
    this.#write(FISCAL_STORAGE_KEYS.citizenTaxPerCapita, String(value));
    return value;
  }

  /**
   * @returns {{ salaryPerMonth: number, salaryTaxRate: number, unemploymentBenefitRate: number }}
   */
  getSalarySettings() {
    return {
      salaryPerMonth: this.#readNumber(
        FISCAL_STORAGE_KEYS.salaryPerMonth,
        DEFAULT_FISCAL_SETTINGS.salaryPerMonth,
        { min: 10, max: 500, integer: true }
      ),
      salaryTaxRate: this.#readNumber(
        FISCAL_STORAGE_KEYS.salaryTaxRate,
        DEFAULT_FISCAL_SETTINGS.salaryTaxRate,
        { min: 0, max: 1, integer: false }
      ),
      unemploymentBenefitRate: this.#readNumber(
        FISCAL_STORAGE_KEYS.unemploymentBenefitRate,
        DEFAULT_FISCAL_SETTINGS.unemploymentBenefitRate,
        { min: 0, max: 1, integer: false }
      ),
    };
  }

  /**
   * @param {{ salaryPerMonth?: number, salaryTaxRate?: number, unemploymentBenefitRate?: number }} partial
   * @returns {{ salaryPerMonth: number, salaryTaxRate: number, unemploymentBenefitRate: number }}
   */
  setSalarySettings(partial = {}) {
    const current = this.getSalarySettings();
    const next = {
      salaryPerMonth:
        partial.salaryPerMonth !== undefined
          ? this.#clamp(partial.salaryPerMonth, 10, 500, true)
          : current.salaryPerMonth,
      salaryTaxRate:
        partial.salaryTaxRate !== undefined
          ? this.#clamp(partial.salaryTaxRate, 0, 1, false)
          : current.salaryTaxRate,
      unemploymentBenefitRate:
        partial.unemploymentBenefitRate !== undefined
          ? this.#clamp(partial.unemploymentBenefitRate, 0, 1, false)
          : current.unemploymentBenefitRate,
    };
    this.#write(FISCAL_STORAGE_KEYS.salaryPerMonth, String(next.salaryPerMonth));
    this.#write(FISCAL_STORAGE_KEYS.salaryTaxRate, String(next.salaryTaxRate));
    this.#write(
      FISCAL_STORAGE_KEYS.unemploymentBenefitRate,
      String(next.unemploymentBenefitRate)
    );
    return next;
  }

  clear() {
    try {
      this.storage?.removeItem(FISCAL_STORAGE_KEYS.citizenTaxPerCapita);
      this.storage?.removeItem(FISCAL_STORAGE_KEYS.salaryPerMonth);
      this.storage?.removeItem(FISCAL_STORAGE_KEYS.salaryTaxRate);
      this.storage?.removeItem(FISCAL_STORAGE_KEYS.unemploymentBenefitRate);
    } catch (error) {
      console.warn('[FiscalSettings] Error clearing:', error);
    }
  }

  /**
   * @param {string} key
   * @param {number} fallback
   * @param {{ min: number, max: number, integer: boolean }} bounds
   */
  #readNumber(key, fallback, bounds) {
    try {
      const stored = this.storage?.getItem(key);
      if (stored === null || stored === undefined) {
        return fallback;
      }
      const parsed = bounds.integer ? parseInt(stored, 10) : parseFloat(stored);
      if (Number.isNaN(parsed)) {
        return fallback;
      }
      return this.#clamp(parsed, bounds.min, bounds.max, bounds.integer);
    } catch (error) {
      console.warn(`[FiscalSettings] Error reading ${key}:`, error);
      return fallback;
    }
  }

  /** @param {string} key @param {string} value */
  #write(key, value) {
    try {
      this.storage?.setItem(key, value);
    } catch (error) {
      console.warn(`[FiscalSettings] Error writing ${key}:`, error);
    }
  }

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @param {boolean} integer
   */
  #clamp(value, min, max, integer) {
    let n = Number(value);
    if (Number.isNaN(n)) {
      return min;
    }
    if (integer) {
      n = Math.round(n);
    }
    return Math.max(min, Math.min(max, n));
  }
}
