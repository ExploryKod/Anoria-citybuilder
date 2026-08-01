/**
 * Port : persistance des bâtiments (aggregate snapshot).
 * Implémentation : contexts/parcels/infrastructure/dexie/
 *
 * Les instanceId au port sont des UUID Dexie (string).
 */
export class BuildingRepository {
  async findById(_instanceId) {
    throw new Error('BuildingRepository: port not implemented');
  }

  async findAll() {
    throw new Error('BuildingRepository: port not implemented');
  }

  async saveRoadAccess(_instanceId, _roadCount) {
    throw new Error('BuildingRepository: port not implemented');
  }

  async saveNeighbors(_instanceId, _neighbors) {
    throw new Error('BuildingRepository: port not implemented');
  }

  /** @returns {Promise<object[]>} voisins bruts (forme IndexedDB) */
  async findNeighbors(_instanceId) {
    throw new Error('BuildingRepository: port not implemented');
  }

  async deleteById(_instanceId) {
    throw new Error('BuildingRepository: port not implemented');
  }
}
