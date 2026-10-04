import db from '../../../../core/persistence/dexie/db.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getGoodCategories, getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { getGoodVatCategory, getVatCategories } from '../../../../shared/resource-catalog/VatCategoryCatalog.js';
import {
  DEFAULT_HAMLET_FISCAL_RATES,
  DEFAULT_SERVICE_SUBSIDY_PERCENT,
  DEFAULT_VAT_GENERAL_RATE_PERCENT,
  DEFAULT_VAT_RATE_PERCENT,
  DEFAULT_VAT_UNIFORM,
  HAMLET_FISCAL_RATE_BOUNDS,
  SERVICE_SUBSIDY_BOUNDS,
  VAT_RATE_BOUNDS,
} from '../../domain/catalogs/FiscalRateCatalog.js';

/**
 * The fiscal rates of the active hamlet, stored on its own row in the game database: the rates are part of the
 * game, emptied and imported with it. Every read is asynchronous and strict: a hamlet without a rate, or a value out
 * of its bounds, throws. Nothing stands in for a missing rate.
 */
export class HamletFiscalRateRepository {
  /** @param {import('dexie').Dexie} [database] */
  constructor(database = db) {
    this.db = database;
  }

  /** @returns {Promise<number>} */
  async getCitizenTaxPerCapita() {
    return this.#read('citizenTaxPerCapita');
  }

  /** @param {number} amount @returns {Promise<number>} */
  async setCitizenTaxPerCapita(amount) {
    await this.#write({ citizenTaxPerCapita: amount });
    return amount;
  }

  /** @returns {Promise<{ salaryPerMonth: number, salaryTaxRate: number, unemploymentBenefitRate: number }>} */
  async getSalarySettings() {
    const [salaryPerMonth, salaryTaxRate, unemploymentBenefitRate] = await Promise.all([
      this.#read('salaryPerMonth'),
      this.#read('salaryTaxRate'),
      this.#read('unemploymentBenefitRate'),
    ]);
    return { salaryPerMonth, salaryTaxRate, unemploymentBenefitRate };
  }

  /** @returns {Promise<Record<string, number>>} the active hamlet's subsidy, in percent, for every service. */
  async getServiceSubsidies() {
    const hamletId = requireActiveHamletId();
    const row = await this.db.hamlets.get(hamletId);
    if (!row) throw new Error(`[fiscal] hamlet ${hamletId} has no row`);
    if (!row.serviceSubsidy) throw new Error(`[fiscal] hamlet ${hamletId} has no service subsidies`);
    return Object.fromEntries(
      getServiceCategories().map((service) => {
        const percent = row.serviceSubsidy[service];
        if (!Number.isInteger(percent)) throw new Error(`[fiscal] hamlet ${hamletId} has no subsidy for ${service}`);
        return [service, percent];
      })
    );
  }

  /**
   * The active hamlet's VAT: the uniform switch, the general rate and the rate of each VAT category.
   * @returns {Promise<{ uniform: boolean, generalRatePercent: number, categoryRatesPercent: Record<string, number> }>}
   */
  async getVatSettings() {
    const hamletId = requireActiveHamletId();
    const row = await this.db.hamlets.get(hamletId);
    if (!row) throw new Error(`[fiscal] hamlet ${hamletId} has no row`);
    if (typeof row.vatUniform !== 'boolean') throw new Error(`[fiscal] hamlet ${hamletId} has no VAT uniform switch`);
    if (!Number.isInteger(row.vatGeneralRatePercent)) throw new Error(`[fiscal] hamlet ${hamletId} has no general VAT rate`);
    if (!row.vatRatePercent) throw new Error(`[fiscal] hamlet ${hamletId} has no VAT rates`);
    const categoryRatesPercent = Object.fromEntries(
      getVatCategories().map((category) => {
        const percent = row.vatRatePercent[category];
        if (!Number.isInteger(percent)) throw new Error(`[fiscal] hamlet ${hamletId} has no VAT rate for ${category}`);
        return [category, percent];
      })
    );
    return { uniform: row.vatUniform, generalRatePercent: row.vatGeneralRatePercent, categoryRatesPercent };
  }

  /**
   * The VAT rate of every good, read through its category: what the settlement taxes each sale at.
   * @returns {Promise<Record<string, number>>}
   */
  async getVatRates() {
    const { categoryRatesPercent } = await this.getVatSettings();
    return Object.fromEntries(getGoodCategories().map((good) => [good, categoryRatesPercent[getGoodVatCategory(good)]]));
  }

  /** @param {boolean} uniform When on, every VAT category takes the general rate. */
  async setVatUniform(uniform) {
    if (typeof uniform !== 'boolean') throw new Error(`[fiscal] the VAT uniform switch must be a boolean, got ${uniform}`);
    const hamletId = requireActiveHamletId();
    const { generalRatePercent } = await this.getVatSettings();
    const patch = { vatUniform: uniform };
    if (uniform) patch.vatRatePercent = uniformVatRates(generalRatePercent);
    await this.db.hamlets.update(hamletId, patch);
    return uniform;
  }

  /** @param {number} percent When the switch is on, every VAT category follows it. @returns {Promise<number>} */
  async setVatGeneralRate(percent) {
    assertInBounds('vatRate', percent);
    const hamletId = requireActiveHamletId();
    const { uniform } = await this.getVatSettings();
    const patch = { vatGeneralRatePercent: percent };
    if (uniform) patch.vatRatePercent = uniformVatRates(percent);
    await this.db.hamlets.update(hamletId, patch);
    return percent;
  }

  /** @param {string} category @param {number} percent @returns {Promise<number>} */
  async setVatCategoryRate(category, percent) {
    if (!getVatCategories().includes(category)) throw new Error(`[fiscal] "${category}" is not a VAT category`);
    assertInBounds('vatRate', percent);
    const hamletId = requireActiveHamletId();
    const { uniform, categoryRatesPercent } = await this.getVatSettings();
    if (uniform) throw new Error('[fiscal] the VAT is uniform: the general rate sets every category');
    await this.db.hamlets.update(hamletId, { vatRatePercent: { ...categoryRatesPercent, [category]: percent } });
    return percent;
  }

  /** @param {string} service @param {number} percent @returns {Promise<number>} */
  async setServiceSubsidy(service, percent) {
    if (!getServiceCategories().includes(service)) throw new Error(`[fiscal] "${service}" is not a service`);
    assertInBounds('serviceSubsidy', percent);
    const hamletId = requireActiveHamletId();
    const current = await this.getServiceSubsidies();
    await this.db.hamlets.update(hamletId, { serviceSubsidy: { ...current, [service]: percent } });
    return percent;
  }

  /**
   * @param {{ salaryPerMonth?: number, salaryTaxRate?: number, unemploymentBenefitRate?: number }} partial
   * @returns {Promise<{ salaryPerMonth: number, salaryTaxRate: number, unemploymentBenefitRate: number }>}
   */
  async setSalarySettings(partial = {}) {
    await this.#write(partial);
    return this.getSalarySettings();
  }

  /**
   * Writes the default rates on a hamlet that has none yet: done once, when the hamlet is created.
   * @param {string} hamletId
   * @returns {Promise<void>}
   */
  async ensureRates(hamletId) {
    const row = await this.db.hamlets.get(hamletId);
    if (!row) throw new Error(`[fiscal] hamlet ${hamletId} has no row to hold its rates`);
    const missing = Object.keys(DEFAULT_HAMLET_FISCAL_RATES).filter((field) => typeof row[field] !== 'number');
    const defaults = Object.fromEntries(missing.map((field) => [field, DEFAULT_HAMLET_FISCAL_RATES[field]]));
    if (!row.serviceSubsidy) {
      defaults.serviceSubsidy = Object.fromEntries(getServiceCategories().map((service) => [service, DEFAULT_SERVICE_SUBSIDY_PERCENT]));
    }
    if (!row.vatRatePercent) {
      defaults.vatRatePercent = Object.fromEntries(getVatCategories().map((category) => [category, DEFAULT_VAT_RATE_PERCENT]));
      defaults.vatUniform = DEFAULT_VAT_UNIFORM;
      defaults.vatGeneralRatePercent = DEFAULT_VAT_GENERAL_RATE_PERCENT;
    }
    if (Object.keys(defaults).length > 0) await this.db.hamlets.update(hamletId, defaults);
  }

  /** @param {keyof typeof DEFAULT_HAMLET_FISCAL_RATES} field */
  async #read(field) {
    const hamletId = requireActiveHamletId();
    const row = await this.db.hamlets.get(hamletId);
    if (!row) throw new Error(`[fiscal] hamlet ${hamletId} has no row`);
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[fiscal] hamlet ${hamletId} has no ${field}: its rates are written when it is created`);
    }
    return value;
  }

  /** @param {Partial<typeof DEFAULT_HAMLET_FISCAL_RATES>} partial */
  async #write(partial) {
    const hamletId = requireActiveHamletId();
    for (const [field, value] of Object.entries(partial)) {
      assertInBounds(field, value);
    }
    await this.db.hamlets.update(hamletId, partial);
  }
}

/**
 * @param {string} field
 * @param {unknown} value
 */
function assertInBounds(field, value) {
  const bounds =
    HAMLET_FISCAL_RATE_BOUNDS[field] ??
    (field === 'serviceSubsidy' ? SERVICE_SUBSIDY_BOUNDS : field === 'vatRate' ? VAT_RATE_BOUNDS : null);
  if (!bounds) throw new Error(`[fiscal] "${field}" is not a hamlet fiscal rate`);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[fiscal] ${field} must be a number, got ${value}`);
  }
  if (bounds.integer && !Number.isInteger(value)) throw new Error(`[fiscal] ${field} must be an integer, got ${value}`);
  if (value < bounds.min || value > bounds.max) {
    throw new Error(`[fiscal] ${field} must be between ${bounds.min} and ${bounds.max}, got ${value}`);
  }
}

/** @param {number} percent @returns {Record<string, number>} the same rate for every VAT category. */
function uniformVatRates(percent) {
  return Object.fromEntries(getVatCategories().map((category) => [category, percent]));
}
