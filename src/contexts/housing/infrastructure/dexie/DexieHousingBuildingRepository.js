import db from '../../../../core/persistence/dexie/db.js';
import { createEmptyStocks } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { isActiveHamletRow } from '../../../../core/persistence/hamlet/hamletSession.js';
import { createHousingBuildingSnapshot } from '../../domain/HousingBuildingSnapshot.js';
import { isResidentialHouseType } from '../../domain/policies/HouseCapacityPolicy.js';
import { normalizeResidentialType } from '../../domain/HouseTypeCatalog.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';
import { footprintFromRecord, footprintOccupiesTile } from '../../../../shared/building-identity/Footprint.js';

/** Housing port adapter — accès direct Dexie (table `houses`). */
export class DexieHousingBuildingRepository {
  #toSnapshot(house) {
    return createHousingBuildingSnapshot({
      // Passed first so any field this BC doesn't explicitly name (e.g.
      // Supply's `servedFlags`) rides along — the explicit keys below then
      // override with their proper row->snapshot remapping/coercion.
      ...house,
      id: instanceIdFromHouseRow(house),
      type: house.type || '',
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      pop: house.pop ?? 0,
      level: house.level ?? 1,
      lastPopulationGrowthMonth: house.lastPopulationGrowthMonth ?? null,
      lastFamineDeathMonth: house.lastFamineDeathMonth ?? null,
      lastConsumption: house.lastConsumption ?? null,
      stocks: house.stocks || createEmptyStocks(),
      price: house.price ?? 0,
    });
  }

  /**
   * @param {string} instanceId
   * @param {Record<string, unknown>} updates
   */
  async #putFields(instanceId, updates) {
    const row = await db.houses.get(instanceId);
    if (!row) return;

    const next = { ...row };
    for (const key of Object.keys(updates)) {
      if (updates[key] !== undefined) {
        next[key] = updates[key];
      }
    }

    await db.houses.put(canonicalizeHouseRecord(next));
  }

  async findById(instanceId) {
    if (!instanceId) return null;
    const row = await db.houses.get(instanceId);
    if (!row) return null;
    return this.#toSnapshot(row);
  }

  async findResidentialAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const rows = await db.houses.toArray();
    const house = rows.find((row) => {
      if (!isActiveHamletRow(row)) return false;
      if (!isResidentialHouseType(normalizeResidentialType(row.type || ''))) {
        return false;
      }
      const footprint = footprintFromRecord(row);
      return footprint && footprintOccupiesTile(footprint, tileX, tileY);
    });
    return house ? this.#toSnapshot(house) : null;
  }

  /**
   * Every residential house of the active hamlet, by each tile of its footprint: the answer of `findResidentialAt` for the whole city from ONE
   * read of the table (asking tile by tile reads the whole table each time).
   * @returns {Promise<Map<string, ReturnType<DexieHousingBuildingRepository['findResidentialHouses']> extends Promise<Array<infer S>> ? S : never>>} keyed `"x,y"`
   */
  async indexResidentialByTile() {
    const rows = await db.houses.toArray();
    const index = new Map();
    for (const row of rows) {
      if (!isActiveHamletRow(row)) continue;
      if (!isResidentialHouseType(normalizeResidentialType(row.type || ''))) continue;
      const footprint = footprintFromRecord(row);
      if (!footprint) continue;
      const snapshot = this.#toSnapshot(row);
      for (const tile of footprint.tiles) index.set(`${tile.x},${tile.y}`, snapshot);
    }
    return index;
  }

  async findResidentialHouses() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => isActiveHamletRow(row) && isResidentialHouseType(row.type || ''))
      .map((row) => this.#toSnapshot(row));
  }

  async listAllResidentialSnapshots() {
    return this.findResidentialHouses();
  }

  async savePopulation(instanceId, payload) {
    if (!instanceId) return;
    const fields = { pop: payload.pop };
    if (payload.lastPopulationGrowthMonth !== undefined) {
      fields.lastPopulationGrowthMonth = payload.lastPopulationGrowthMonth;
    }
    if (payload.lastFamineDeathMonth !== undefined) {
      fields.lastFamineDeathMonth = payload.lastFamineDeathMonth;
    }
    await this.#putFields(instanceId, fields);
  }

  /** Persist the crises of a house (what made inhabitants leave, see RunMonthlyDepartures.js) with its population after the departures. */
  async saveDepartures(instanceId, { departures, repopulationBans, pop }) {
    if (!instanceId) return;
    await this.#putFields(instanceId, { departures, repopulationBans, pop });
  }

  /**
   * Persist a level change (1 <-> 2) for a Blue/Red/Purple house. The house `type` (color) never changes here — only
   * `level` and `pop` (see `HouseLevelPolicy`).
   *
   * @param {object} params
   * @param {string} params.houseId
   * @param {1 | 2} params.targetLevel
   * @param {number} params.targetPop
   */
  async applyLevelChange({ houseId, targetLevel, targetPop }) {
    await this.#putFields(houseId, {
      level: targetLevel,
      pop: targetPop,
    });
  }
}
