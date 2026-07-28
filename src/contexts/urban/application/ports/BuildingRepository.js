/**
 * Port : persistance des bâtiments (aggregate snapshot).
 * Implémentation : infrastructure/persistence/dexie/
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
}
