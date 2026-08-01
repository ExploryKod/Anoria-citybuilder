import db from '../../../../core/persistence/dexie/db.js';

/** @typedef {(turn: number) => { monthIndex: number, year: number } | null} ResolveTimeInfo */

/**
 * Dexie-backed factory production journal (Supply BC infrastructure).
 */
export class SupplyProductionJournal {
  static PRICES = Object.freeze({
    wood: 2,
    logs: 4,
    furniture: 6,
    gold: 5,
    refinedGold: 8,
    jewelry: 12,
    clay: 2,
    refinedClay: 4,
    pottery: 6,
    iron: 3,
    refinedIron: 6,
    weapons: 10,
  });

  static EVENT_TYPES = Object.freeze({
    COLLECT_WOOD: 'collect_wood',
    TRANSFORM_WOOD_TO_LOGS: 'transform_wood_to_logs',
    TRANSFORM_GOLD_TO_REFINED_GOLD: 'transform_gold_to_refined_gold',
    TRANSFORM_CLAY_TO_REFINED_CLAY: 'transform_clay_to_refined_clay',
    TRANSFORM_IRON_TO_REFINED_IRON: 'transform_iron_to_refined_iron',
    DELIVER_LOGS_TO_CARPENTERS: 'deliver_logs_to_carpenters',
    PRODUCE_FURNITURE: 'produce_furniture',
    PRODUCE_JEWELRY: 'produce_jewelry',
    PRODUCE_POTTERY: 'produce_pottery',
    PRODUCE_WEAPONS: 'produce_weapons',
  });

  /**
   * @param {object} [deps]
   * @param {import('dexie').Dexie} [deps.db]
   * @param {ResolveTimeInfo} [deps.resolveTimeInfo]
   */
  constructor(deps = {}) {
    this.db = deps.db ?? db;
    this.#resolveTimeInfo = deps.resolveTimeInfo ?? (() => null);
  }

  /** @type {ResolveTimeInfo} */
  #resolveTimeInfo;

  getPrice(resourceType) {
    return SupplyProductionJournal.PRICES[resourceType] || 0;
  }

  /**
   * @param {number} turn
   * @param {string} factoryId
   * @param {string} eventType
   * @param {string} resourceType
   * @param {number} quantity
   * @param {object} [remainingStocks]
   * @param {number|null} [materialConsumed]
   * @param {number|null} [customPrice]
   * @param {number[]|null} [productionTurns]
   * @returns {Promise<number|null>}
   */
  async addProductionEntry(
    turn,
    factoryId,
    eventType,
    resourceType,
    quantity,
    remainingStocks = {},
    materialConsumed = null,
    customPrice = null,
    productionTurns = null
  ) {
    try {
      if (!this.db.productionJournal) {
        console.error('[SupplyProductionJournal] productionJournal store not found in database');
        return null;
      }

      let month = null;
      let year = null;
      const timeInfo = this.#resolveTimeInfo(turn);
      if (timeInfo) {
        month = timeInfo.monthIndex + 1;
        year = timeInfo.year;
      }

      const price =
        customPrice !== null ? customPrice : this.getPrice(resourceType) * quantity;

      const entry = {
        turn,
        month,
        year,
        date: new Date().toISOString(),
        factoryId,
        eventType,
        resourceType,
        quantity,
        price,
        remainingStocks,
      };

      if (materialConsumed !== null && materialConsumed !== undefined) {
        entry.materialConsumed = materialConsumed;
        if (eventType === 'produce_furniture') {
          entry.logsConsumed = materialConsumed;
        }
      }

      if (productionTurns !== null && productionTurns !== undefined && Array.isArray(productionTurns)) {
        entry.productionTurns = productionTurns;
      }

      try {
        return await this.db.productionJournal.add(entry);
      } catch (addError) {
        if (addError.name === 'ConstraintError' || addError.message?.includes('Key already exists')) {
          console.warn('[SupplyProductionJournal] Entry already exists (ConstraintError), skipping duplicate entry:', {
            turn: entry.turn,
            factoryId: entry.factoryId,
            eventType: entry.eventType,
          });
          return null;
        }
        throw addError;
      }
    } catch (error) {
      console.error('[SupplyProductionJournal] Error adding production entry:', error);
      return null;
    }
  }

  /** @param {string|null} [factoryId] @param {number|null} [turn] */
  async getProductionEntries(factoryId = null, turn = null) {
    try {
      let query = this.db.productionJournal.orderBy('turn');

      if (factoryId) {
        query = query.filter((entry) => entry.factoryId === factoryId);
      }

      if (turn !== null) {
        query = query.filter((entry) => entry.turn === turn);
      }

      return await query.reverse().toArray();
    } catch (error) {
      console.error('[SupplyProductionJournal] Error getting production entries:', error);
      return [];
    }
  }

  async getProductionEntriesByFactory() {
    try {
      const entries = await this.getProductionEntries();
      const grouped = {};

      for (const entry of entries) {
        if (!grouped[entry.factoryId]) {
          grouped[entry.factoryId] = [];
        }
        grouped[entry.factoryId].push(entry);
      }

      return grouped;
    } catch (error) {
      console.error('[SupplyProductionJournal] Error grouping production entries:', error);
      return {};
    }
  }

  /** @param {string} factoryId */
  async getFactoryProductionEntries(factoryId) {
    return this.getProductionEntries(factoryId);
  }

  /** @param {number} turn */
  async getTurnProductionEntries(turn) {
    return this.getProductionEntries(null, turn);
  }

  async clearAllEntries() {
    await this.db.productionJournal.clear();
  }
}

export const supplyProductionJournal = new SupplyProductionJournal();

/** @internal Tests */
export function resetSupplyProductionJournalForTests() {
  // Singleton keeps db reference; tests inject db on instance when needed.
}
