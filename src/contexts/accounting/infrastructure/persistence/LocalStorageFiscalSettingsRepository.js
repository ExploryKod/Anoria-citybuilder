/**
 * localStorage adapter — the customs rate only: one rate for the whole city, kept apart from the hamlets' rates
 * (see HamletFiscalRateRepository). Written with its default once, at boot; a missing or out-of-bounds value throws.
 */

export const FISCAL_STORAGE_KEYS = Object.freeze({
  customsRate: 'commerce_customs_rate',
});

/** The customs rate a city starts with, and the bounds the admin panel accepts. */
export const DEFAULT_FISCAL_SETTINGS = Object.freeze({
  customsRate: 0.15,
});

const CUSTOMS_BOUNDS = Object.freeze({ min: 0, max: 0.5 });

export class LocalStorageFiscalSettingsRepository {
  /**
   * @param {Storage|null} [storage]
   */
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
  }

  /** Writes the default customs rate when the city has none yet. */
  ensureCustomsRate() {
    if (this.#raw() === null) this.#write(DEFAULT_FISCAL_SETTINGS.customsRate);
  }

  /** @returns {number} customs rate in [0, 0.5] */
  getCustomsRate() {
    const raw = this.#raw();
    if (raw === null) throw new Error('[fiscal] the customs rate is not set: ensureCustomsRate() must run at boot');
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`[fiscal] the stored customs rate is not a number: "${raw}"`);
    return value;
  }

  /** @param {number} rate @returns {number} the rate, once stored */
  setCustomsRate(rate) {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < CUSTOMS_BOUNDS.min || rate > CUSTOMS_BOUNDS.max) {
      throw new Error(`[fiscal] the customs rate must be between ${CUSTOMS_BOUNDS.min} and ${CUSTOMS_BOUNDS.max}, got ${rate}`);
    }
    this.#write(rate);
    return rate;
  }

  clear() {
    this.storage?.removeItem(FISCAL_STORAGE_KEYS.customsRate);
  }

  /** @returns {string | null} */
  #raw() {
    return this.storage?.getItem(FISCAL_STORAGE_KEYS.customsRate) ?? null;
  }

  /** @param {number} rate */
  #write(rate) {
    if (!this.storage) throw new Error('[fiscal] no storage to keep the customs rate in');
    this.storage.setItem(FISCAL_STORAGE_KEYS.customsRate, String(rate));
  }
}
