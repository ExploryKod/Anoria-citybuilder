import { createBuildingSnapshot } from '../../../contexts/urban/domain/BuildingSnapshot.js';
import { toPublishedBuildingId } from '../../../contexts/urban/domain/value-objects/BuildingId.js';

/**
 * Adapter : traduit HousesStore (legacy) vers le port BuildingRepository.
 * Frontière : strings IndexedDB ↔ snapshots Urban (BuildingId / TileCoord).
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

  /**
   * @param {string | Readonly<{ value: string }>} buildingId
   */
  async findById(buildingId) {
    const id = toPublishedBuildingId(buildingId);
    const house = await this.housesStore.getHouse(id);
    if (!house) return null;
    return this.#toSnapshot(house);
  }

  async findAll() {
    const houses = await this.housesStore.listAllHouses();
    return houses.map((house) => this.#toSnapshot(house));
  }

  /**
   * @param {string | Readonly<{ value: string }>} buildingId
   * @param {number} roadCount
   */
  async saveRoadAccess(buildingId, roadCount) {
    const id = toPublishedBuildingId(buildingId);
    await this.housesStore.updateHouseFields(id, { roads: roadCount });
  }
}
