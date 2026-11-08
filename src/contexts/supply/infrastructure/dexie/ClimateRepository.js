import db from '../../../../core/persistence/dexie/db.js';

/** The climate of the years drawn so far, in the game's settings: `{ [year]: { phase, harvestFactor } }`. One row per climate (the city's, the world's). */
export class ClimateRepository {
  /** @param {string} settingName the row it is kept in @param {import('dexie').Dexie} [database] */
  constructor(settingName, database = db) {
    if (!settingName) throw new Error('[climate] a climate is kept under a name');
    this.settingName = settingName;
    this.db = database;
  }

  /** @returns {Promise<Record<string, { phase: string, harvestFactor: number }>>} */
  async get() {
    const row = await this.db.gameSettings.get(this.settingName);
    return row ? { ...row.years } : {};
  }

  /** @param {Record<string, { phase: string, harvestFactor: number }>} years */
  async save(years) {
    await this.db.gameSettings.put({ name: this.settingName, years });
  }
}
