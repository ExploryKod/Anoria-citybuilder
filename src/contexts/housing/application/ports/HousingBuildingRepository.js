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

  /** @returns {Promise<Map<string, object>>} the residential houses by each tile of their footprint, keyed "x,y" */
  async indexResidentialByTile() {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async findResidentialHouses() {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  async savePopulation(_buildingId, _payload) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  /** Persist a house's crises of departure and its population after the departures. */
  async saveDepartures(_buildingId, _payload) {
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
