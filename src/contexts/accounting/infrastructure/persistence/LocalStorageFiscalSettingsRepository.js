/**
 * localStorage adapter — the customs duties only: one duty per traded good and per flow (import / export), for the
 * whole city, kept apart from the hamlets' rates (see HamletFiscalRateRepository). Written from the catalog's defaults
 * at boot (a good the stored table lacks gets its default; a duty already set is kept); a missing good or an
 * out-of-bounds value throws, nothing is guessed at read time.
 */

import { CUSTOMS_FLOWS, CUSTOMS_RATE_BOUNDS, defaultCustomsDuty } from '../../domain/catalogs/FiscalRateCatalog.js';

export const FISCAL_STORAGE_KEYS = Object.freeze({
  customsDuties: 'commerce_customs_duties',
});

/** @typedef {{ import: Record<string, number>, export: Record<string, number> }} CustomsDuties */

export class LocalStorageFiscalSettingsRepository {
  /**
   * @param {Storage|null} [storage]
   */
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
  }

  /**
   * Boot: gives every traded good the duty of each flow it takes, from the catalog, unless one is already stored.
   * @param {ReadonlyArray<{ good: string, flows: ReadonlyArray<'import' | 'export'> }>} tradedGoods
   */
  ensureCustomsDuties(tradedGoods) {
    const duties = this.#read() ?? { import: {}, export: {} };
    for (const { good, flows } of tradedGoods) {
      for (const flow of flows) {
        if (duties[flow][good] === undefined) duties[flow][good] = defaultCustomsDuty(flow, good);
      }
    }
    this.#write(duties);
  }

  /**
   * The duty a customs authority charges on one good for one flow, in force at a turn. Only Anoria's customs exist, and a
   * duty has no history yet (its changes are logged as policy events, see createAccountingContext), so the turn is not read:
   * both arguments are the hooks of the later trade-policy phase (other cities' tariffs, rates that change over time).
   * @param {string} authority whose customs: 'anoria'
   * @param {'import' | 'export'} flow
   * @param {string} good
   * @param {number} turn
   * @returns {number} the duty, in [0, 1]
   */
  getCustomsDuty(authority, flow, good, turn) {
    if (authority !== 'anoria') throw new Error(`[fiscal] the customs of "${authority}" are not modelled: only Anoria's are`);
    if (!Number.isFinite(turn)) throw new Error(`[fiscal] the duty on ${good} is asked for no turn (${turn})`);
    this.#requireFlow(flow);
    const duties = this.#read();
    if (!duties) throw new Error('[fiscal] the customs duties are not set: ensureCustomsDuties() must run at boot');
    const duty = duties[flow][good];
    if (duty === undefined) throw new Error(`[fiscal] no ${flow} duty for "${good}": it is not a good this city trades`);
    return duty;
  }

  /**
   * @param {'import' | 'export'} flow
   * @param {string} good
   * @param {number} rate
   * @returns {number} the duty, once stored
   */
  setCustomsDuty(flow, good, rate) {
    this.#requireFlow(flow);
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < CUSTOMS_RATE_BOUNDS.min || rate > CUSTOMS_RATE_BOUNDS.max) {
      throw new Error(`[fiscal] a customs duty must be between ${CUSTOMS_RATE_BOUNDS.min} and ${CUSTOMS_RATE_BOUNDS.max}, got ${rate}`);
    }
    const duties = this.#read();
    if (!duties) throw new Error('[fiscal] the customs duties are not set: ensureCustomsDuties() must run at boot');
    if (duties[flow][good] === undefined) throw new Error(`[fiscal] no ${flow} duty for "${good}": it is not a good this city trades`);
    duties[flow][good] = rate;
    this.#write(duties);
    return rate;
  }

  /** @returns {CustomsDuties} every duty, a copy */
  listCustomsDuties() {
    const duties = this.#read();
    if (!duties) throw new Error('[fiscal] the customs duties are not set: ensureCustomsDuties() must run at boot');
    return { import: { ...duties.import }, export: { ...duties.export } };
  }

  clear() {
    this.storage?.removeItem(FISCAL_STORAGE_KEYS.customsDuties);
  }

  /** @param {string} flow */
  #requireFlow(flow) {
    if (!CUSTOMS_FLOWS.includes(flow)) throw new Error(`[fiscal] unknown customs flow "${flow}"`);
  }

  /** @returns {CustomsDuties | null} */
  #read() {
    const raw = this.storage?.getItem(FISCAL_STORAGE_KEYS.customsDuties) ?? null;
    if (raw === null) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`[fiscal] the stored customs duties are not JSON: "${raw}"`);
    }
    if (!parsed?.import || !parsed?.export) throw new Error('[fiscal] the stored customs duties lack their import or export table');
    return parsed;
  }

  /** @param {CustomsDuties} duties */
  #write(duties) {
    if (!this.storage) throw new Error('[fiscal] no storage to keep the customs duties in');
    this.storage.setItem(FISCAL_STORAGE_KEYS.customsDuties, JSON.stringify(duties));
  }
}
