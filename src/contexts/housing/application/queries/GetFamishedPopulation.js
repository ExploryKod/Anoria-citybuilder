import { computeCityFamishedPopulation } from '../../domain/policies/FamishedPopulationPolicy.js';

/**
 * Query: city-wide famished population (residents not fed from home stocks).
 *
 * Reads `pop` (Housing) and `stocks.food` (written by Supply) from persistence.
 * Does not import Supply domain — conformist read on shared Dexie row.
 */
export class GetFamishedPopulation {
  /**
   * @param {import('../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @returns {Promise<{
   *   totalPopulation: number,
   *   fedPopulation: number,
   *   famishedPopulation: number,
   * }>}
   */
  async execute() {
    const houses = await this.repository.listAllResidentialSnapshots();
    return computeCityFamishedPopulation(houses);
  }
}
