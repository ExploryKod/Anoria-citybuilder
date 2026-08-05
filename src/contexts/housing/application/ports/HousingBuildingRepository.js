/**
 * Port: persistence for housing-relevant building fields.
 */
export class HousingBuildingRepository {
  async findById(_buildingId) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async findResidentialAt(_x, _y) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async findResidentialHouses() {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async savePopulation(_buildingId, _payload) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async applyEvolution(_payload) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  /** Persist a level change (1 <-> 2) — house `type`/color never changes here. */
  async applyLevelChange(_payload) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async listAllResidentialSnapshots() {
    throw new Error('HousingBuildingRepository: port not implemented');
  }
}
