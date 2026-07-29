import { createHousingBuildingSnapshot } from '../../domain/HousingBuildingSnapshot.js';
import { isResidentialHouseType } from '../../domain/policies/HouseCapacityPolicy.js';
import {
  normalizeResidentialType,
  priceForResidentialType,
} from '../../domain/HouseTypeCatalog.js';
import { toBuildingIdString } from '../../../../shared/building-identity/BuildingId.js';
import { publishedIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Dexie / HousesStore adapter for Housing.
 */
export class DexieHousingBuildingRepository {
  /**
   * @param {import('../../../../js/stores/HousesStore.js').default} housesStore
   */
  constructor(housesStore) {
    this.housesStore = housesStore;
  }

  #toSnapshot(house) {
    return createHousingBuildingSnapshot({
      id: publishedIdFromHouseRow(house),
      type: house.type || '',
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      pop: house.pop ?? 0,
      lastPopulationGrowthMonth: house.lastPopulationGrowthMonth ?? null,
      stocks: house.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
      price: house.price ?? 0,
      neighbors: house.neighbors || [],
    });
  }

  async findById(buildingId) {
    if (!buildingId) return null;
    const house = await this.housesStore.getHouse(buildingId);
    if (!house) return null;
    return this.#toSnapshot(house);
  }

  async findResidentialAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const houses = await this.housesStore.listAllHouses();
    const house = houses.find(
      (row) =>
        row.x === x &&
        row.y === y &&
        isResidentialHouseType(normalizeResidentialType(row.type || ''))
    );
    return house ? this.#toSnapshot(house) : null;
  }

  async findResidentialHouses() {
    const houses = await this.housesStore.listAllHouses();
    return houses
      .filter((house) => isResidentialHouseType(house.type || ''))
      .map((house) => this.#toSnapshot(house));
  }

  async listAllResidentialSnapshots() {
    return this.findResidentialHouses();
  }

  /**
   * @param {string} buildingId
   * @param {{ pop: number, lastPopulationGrowthMonth?: number | null }} payload
   */
  async savePopulation(buildingId, payload) {
    if (!buildingId) return;
    const fields = { pop: payload.pop };
    if (payload.lastPopulationGrowthMonth !== undefined) {
      fields.lastPopulationGrowthMonth = payload.lastPopulationGrowthMonth;
    }
    await this.housesStore.updateHouseFields(buildingId, fields);
  }

  /**
   * @param {object} params
   * @param {string} params.oldId
   * @param {string} params.targetType
   * @param {number} params.targetPop
   * @returns {Promise<{ newId: string, previousId: string }>}
   */
  async applyEvolution({ oldId, targetType, targetPop }) {
    const house = await this.housesStore.getHouse(oldId);
    const x = house?.x;
    const y = house?.y;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`DexieHousingBuildingRepository: missing coordinates for ${oldId}`);
    }

    const newId = toBuildingIdString(targetType, x, y);
    if (!newId) {
      throw new Error(`DexieHousingBuildingRepository: invalid evolution target ${targetType}`);
    }

    const price = priceForResidentialType(targetType);
    const neighbors = house?.neighbors || [];
    const roads = house?.roads ?? 0;
    const stocks = house?.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
    const worldTime = house?.worldTime ?? 0;

    if (newId !== oldId) {
      const updateResult = await this.housesStore.updateHouseName(oldId, newId, {
        type: targetType,
        price,
      });

      if (!updateResult?.success) {
        await this.housesStore.addHouse({
          name: newId,
          type: targetType,
          price,
          x,
          y,
          neighbors,
          pop: targetPop,
          stocks,
          roads,
          worldTime,
        });
      } else {
        await this.housesStore.updateHouseFields(newId, {
          neighbors,
          roads,
          pop: targetPop,
        });
      }
    } else {
      await this.housesStore.updateHouseFields(oldId, { pop: targetPop });
    }

    return { newId, previousId: oldId };
  }
}
