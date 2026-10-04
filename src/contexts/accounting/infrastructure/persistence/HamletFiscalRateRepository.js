import db from '../../../../core/persistence/dexie/db.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getGoodCategories, getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import {
  DEFAULT_HAMLET_FISCAL_RATES,
  DEFAULT_SERVICE_SUBSIDY_PERCENT,
  DEFAULT_VAT_RATE_PERCENT,
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

  /** @returns {Promise<Record<string, number>>} the active hamlet's VAT rate, in percent, for every good. */
  async getVatRates() {
    const hamletId = requireActiveHamletId();
    const row = await this.db.hamlets.get(hamletId);
    if (!row) throw new Error(`[fiscal] hamlet ${hamletId} has no row`);
    if (!row.vatRatePercent) throw new Error(`[fiscal] hamlet ${hamletId} has no VAT rates`);
    return Object.fromEntries(
      getGoodCategories().map((good) => {
        const percent = row.vatRatePercent[good];
        if (!Number.isInteger(percent)) throw new Error(`[fiscal] hamlet ${hamletId} has no VAT rate for ${good}`);
        return [good, percent];
      })
    );
  }

  /** @param {string} good @param {number} percent @returns {Promise<number>} */
  async setVatRate(good, percent) {
    if (!getGoodCategories().includes(good)) throw new Error(`[fiscal] "${good}" is not a good taxed by VAT`);
    assertInBounds('vatRate', percent);
    const hamletId = requireActiveHamletId();
    const current = await this.getVatRates();
    await this.db.hamlets.update(hamletId, { vatRatePercent: { ...current, [good]: percent } });
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
      defaults.vatRatePercent = Object.fromEntries(getGoodCategories().map((good) => [good, DEFAULT_VAT_RATE_PERCENT]));
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
