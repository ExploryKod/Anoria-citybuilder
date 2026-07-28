import { createBuildingSnapshot } from '../../../contexts/urban/domain/BuildingSnapshot.js';

/**
 * Adapter : traduit HousesStore (legacy) vers le port BuildingRepository.
 */
export class DexieBuildingRepository {
  /**
   * @param {import('../../../js/stores/HousesStore.js').default} housesStore
   */
  constructor(housesStore) {
    this.housesStore = housesStore;
  }

  /**
   * @param {object} house
   */
  #toSnapshot(house) {
    return createBuildingSnapshot({
      id: house.id || house.name,
      type: house.type || '',
      neighbors: house.neighbors || [],
      roadCount: house.roads ?? 0,
      x: house.x ?? null,
      y: house.y ?? null,
    });
  }

  async findById(buildingId) {
    const house = await this.housesStore.getHouse(buildingId);
    if (!house) return null;
    return this.#toSnapshot(house);
  }

  async findAll() {
    const houses = await this.housesStore.listAllHouses();
    return houses.map((house) => this.#toSnapshot(house));
  }

  async saveRoadAccess(buildingId, roadCount) {
    await this.housesStore.updateHouseFields(buildingId, { roads: roadCount });
  }
}
