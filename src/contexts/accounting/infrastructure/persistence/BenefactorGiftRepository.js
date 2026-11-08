import db from '../../../../core/persistence/dexie/db.js';

const SETTING_NAME = 'benefactorGift';

/**
 * The one gift a game's city is offered, kept in the game's settings (the offer and what the player answered): `null` while none was made. A refusal moves no money, so it
 * is no journal line; the gift itself, when accepted, is an écriture (BenefactorGift.js).
 */
export class BenefactorGiftRepository {
  /** @param {import('dexie').Dexie} [database] */
  constructor(database = db) {
    this.db = database;
  }

  /** @returns {Promise<{ cityId: string, amount: number, turn: number, status: 'offered' | 'accepted' | 'refused' } | null>} */
  async get() {
    const row = await this.db.gameSettings.get(SETTING_NAME);
    return row ? { cityId: row.cityId, amount: row.amount, turn: row.turn, status: row.status } : null;
  }

  /** @param {{ cityId: string, amount: number, turn: number, status: 'offered' | 'accepted' | 'refused' }} gift */
  async save(gift) {
    await this.db.gameSettings.put({ name: SETTING_NAME, ...gift });
  }
}
