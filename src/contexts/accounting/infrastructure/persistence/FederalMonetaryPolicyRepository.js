import db from '../../../../core/persistence/dexie/db.js';
import { DEFAULT_FEDERAL_MONETARY_POLICY, FEDERAL_MONETARY_POLICY_BOUNDS } from '../../domain/catalogs/FiscalRateCatalog.js';

const SETTING_NAME = 'federalMonetaryPolicy';

/**
 * The federation's monetary policy (the policy rate and the reserve ratio its central bank sets for every State: see docs/gameplay/PLAN_BANK_MONEY.md), stored once
 * for the game in its settings, not on a hamlet: the game's data, emptied and imported with it. Written from the catalog's defaults at boot; every read is strict (a
 * game without it, or a lever out of its bounds, throws: nothing stands in for a missing rate).
 */
export class FederalMonetaryPolicyRepository {
  /** @param {import('dexie').Dexie} [database] */
  constructor(database = db) {
    this.db = database;
  }

  /** Boot: writes the catalog's defaults for a lever the game does not hold yet; a lever already set is kept. */
  async ensure() {
    const row = (await this.db.gameSettings.get(SETTING_NAME)) ?? { name: SETTING_NAME };
    const missing = Object.keys(DEFAULT_FEDERAL_MONETARY_POLICY).filter((lever) => typeof row[lever] !== 'number');
    if (missing.length === 0) return;
    await this.db.gameSettings.put({ ...row, ...Object.fromEntries(missing.map((lever) => [lever, DEFAULT_FEDERAL_MONETARY_POLICY[lever]])) });
  }

  /** @returns {Promise<{ policyRate: number, reserveRatio: number }>} the levers the player set */
  async get() {
    const row = await this.db.gameSettings.get(SETTING_NAME);
    if (!row) throw new Error('[federal-bank] the game has no monetary policy: it is written at boot (ensure)');
    return Object.fromEntries(Object.keys(DEFAULT_FEDERAL_MONETARY_POLICY).map((lever) => [lever, assertInBounds(lever, row[lever])]));
  }

  /** @param {'policyRate' | 'reserveRatio'} lever @param {number} value @returns {Promise<number>} */
  async set(lever, value) {
    assertInBounds(lever, value);
    const row = await this.db.gameSettings.get(SETTING_NAME);
    if (!row) throw new Error('[federal-bank] the game has no monetary policy: it is written at boot (ensure)');
    await this.db.gameSettings.put({ ...row, [lever]: value });
    return value;
  }
}

/** @param {string} lever @param {unknown} value @returns {number} */
function assertInBounds(lever, value) {
  const bounds = FEDERAL_MONETARY_POLICY_BOUNDS[lever];
  if (!bounds) throw new Error(`[federal-bank] "${lever}" is not a lever of the monetary policy`);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds.min || value > bounds.max) {
    throw new Error(`[federal-bank] ${lever} must be a number between ${bounds.min} and ${bounds.max}, got ${value}`);
  }
  return value;
}
