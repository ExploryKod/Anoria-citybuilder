import db from '../../../../core/persistence/dexie/db.js';
import { createHousingBuildingSnapshot } from '../../domain/HousingBuildingSnapshot.js';
import { isResidentialHouseType } from '../../domain/policies/HouseCapacityPolicy.js';
import {
  normalizeResidentialType,
  priceForResidentialType,
} from '../../domain/HouseTypeCatalog.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
  residentialTierPatch,
} from '../../../../shared/building-identity/index.js';
import { footprintFromRecord, footprintOccupiesTile } from '../../../../shared/building-identity/Footprint.js';

/** Housing port adapter — accès direct Dexie (table `houses`). */
export class DexieHousingBuildingRepository {
  #toSnapshot(house) {
    return createHousingBuildingSnapshot({
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
      stocks: house.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
      price: house.price ?? 0,
      neighbors: house.neighbors || [],
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
      if (!isResidentialHouseType(normalizeResidentialType(row.type || ''))) {
        return false;
      }
      const footprint = footprintFromRecord(row);
      return footprint && footprintOccupiesTile(footprint, tileX, tileY);
    });
    return house ? this.#toSnapshot(house) : null;
  }

  async findResidentialHouses() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => isResidentialHouseType(row.type || ''))
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

  async applyEvolution({ oldId, targetType, targetPop }) {
    const row = await db.houses.get(oldId);
    if (!row) {
      throw new Error(`DexieHousingBuildingRepository: house not found ${oldId}`);
    }

    const instanceId = instanceIdFromHouseRow(row);
    const price = priceForResidentialType(targetType);
    const tierPatch = residentialTierPatch({
      instanceId,
      targetType,
    });

    await this.#putFields(instanceId, {
      ...tierPatch,
      price,
      pop: targetPop,
    });

    return { newId: instanceId, previousId: instanceId };
  }

  /**
   * Persist a level change (1 <-> 2) for a Blue/Red/Purple house. Unlike
   * `applyEvolution`, the house `type` (color) never changes here — only
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
