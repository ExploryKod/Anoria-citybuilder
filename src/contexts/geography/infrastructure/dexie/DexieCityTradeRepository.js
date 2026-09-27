import db from '../../../../core/persistence/dexie/db.js';

/**
 * @typedef {{
 *   cityId: string,
 *   status: 'active' | 'suspended' | 'expired',
 *   demandMultiplier: number,
 *   satisfactionScore: number,
 *   contractStartMonth: number,
 *   contractEndMonth: number,
 *   lastOrderMonth: number | null,
 * }} CityRelationRow
 */

export class DexieCityTradeRepository {
  /** @param {string} cityId @returns {Promise<CityRelationRow | undefined>} */
  getRelation(cityId) {
    return db.cityRelations.get(cityId);
  }

  /** @returns {Promise<CityRelationRow[]>} */
  getAllRelations() {
    return db.cityRelations.toArray();
  }

  /** @returns {Promise<CityRelationRow[]>} */
  getActiveRelations() {
    return db.cityRelations.where('status').equals('active').toArray();
  }

  /** @param {CityRelationRow} relation @returns {Promise<void>} */
  async saveRelation(relation) {
    await db.cityRelations.put(relation);
  }

  /** @param {string} cityId @returns {Promise<void>} */
  async deleteRelation(cityId) {
    await db.cityRelations.delete(cityId);
  }
}
