/**
 * Port : persistance des bâtiments (aggregate snapshot).
 * Implémentation : contexts/parcels/infrastructure/dexie/
 *
 * Les buildingId au port sont en Published Language (string).
 */
export class BuildingRepository {
  async findById(_buildingId) {
    throw new Error('BuildingRepository: port not implemented');
  }

  async findAll() {
    throw new Error('BuildingRepository: port not implemented');
  }

  async saveRoadAccess(_buildingId, _roadCount) {
    throw new Error('BuildingRepository: port not implemented');
  }

  async saveNeighbors(_buildingId, _neighbors) {
    throw new Error('BuildingRepository: port not implemented');
  }

  /** @returns {Promise<object[]>} voisins bruts (forme IndexedDB) */
  async findNeighbors(_buildingId) {
    throw new Error('BuildingRepository: port not implemented');
  }

  async deleteById(_buildingId) {
    throw new Error('BuildingRepository: port not implemented');
  }
}
