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

  /**
   * For each house, how many of its residents work and the sum of the pollution levels of their workplaces (the work exposes them: see HealthFactorCatalog.js).
   * @returns {Promise<Map<string, { workers: number, exposure: number }>>} only the houses that have workers
   */
  async workplaceExposureByHouse() {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  /**
   * The pollution level of each workplace that employs, by workplace id (the work exposes whoever works there: see HealthFactorCatalog.js).
   * @returns {Promise<Map<string, number>>}
   */
  async pollutionByWorkplace() {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  /**
   * For each residential house, the sick and the residents of the other houses within `radius` tiles: what the contagion spreads from.
   * @param {number} _radius
   * @returns {Promise<Map<string, { sick: number, residents: number }>>}
   */
  async neighbourSickByHouse(_radius) {
    throw new Error('HousingBuildingRepository: port not implemented');
  }

  /** Persist a month's health judgement of a house: its citizens' new health, those who died, how many are sick or invalid, and the month judged. */
  async saveHealthJudgement(_buildingId, _judgement) {
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
