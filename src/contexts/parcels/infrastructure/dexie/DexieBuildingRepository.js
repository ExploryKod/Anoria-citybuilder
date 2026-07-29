import { createBuildingSnapshot } from '../../domain/BuildingSnapshot.js';
import {
  toPublishedBuildingId,
  publishedIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';

/**
 * Adapter : traduit HousesStore (legacy) vers le port BuildingRepository.
 * Frontière : strings IndexedDB ↔ snapshots Parcels (BuildingId / TileCoord).
 */
export class DexieBuildingRepository {
  /**
   * @param {import('../../../../js/stores/HousesStore.js').default} housesStore
   */
  constructor(housesStore) {
    this.housesStore = housesStore;
  }

  /**
   * @param {object} house
   */
  #toSnapshot(house) {
    return createBuildingSnapshot({
      id: publishedIdFromHouseRow(house),
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

  /**
   * @param {string | Readonly<{ value: string }>} buildingId
   * @param {object[]} neighbors
   */
  async saveNeighbors(buildingId, neighbors) {
    const id = toPublishedBuildingId(buildingId);
    await this.housesStore.updateHouseFields(id, { neighbors });
  }

  async findNeighbors(buildingId) {
    const id = toPublishedBuildingId(buildingId);
    const house = await this.housesStore.getHouse(id);
    if (!house) return [];
    return Array.isArray(house.neighbors) ? house.neighbors : [];
  }

  /**
   * @param {string | Readonly<{ value: string }>} buildingId
   */
  async deleteById(buildingId) {
    const id = toPublishedBuildingId(buildingId);
    await this.housesStore.deleteOneHouse(id);
  }
}
