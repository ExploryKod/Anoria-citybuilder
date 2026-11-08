import db from '../../../../core/persistence/dexie/db.js';

const SETTING_NAME = 'worldMarket';

/** Where the world market stands (the month it was drawn up to and the index of each good), in the game's settings. */
export class WorldMarketRepository {
  /** @param {import('dexie').Dexie} [database] */
  constructor(database = db) {
    this.db = database;
  }

  /** @returns {Promise<{ monthKey: number, indices: Record<string, number> } | null>} */
  async get() {
    const row = await this.db.gameSettings.get(SETTING_NAME);
    return row ? { monthKey: row.monthKey, indices: { ...row.indices } } : null;
  }

  /** @param {{ monthKey: number, indices: Record<string, number> }} state */
  async save(state) {
    await this.db.gameSettings.put({ name: SETTING_NAME, ...state });
  }
}
