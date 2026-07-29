import { computePopulationAfterGrowth } from '../../../domain/policies/PopulationGrowthPolicy.js';

/**
 * Command: apply monthly population growth for one residential house.
 */
export class GrowHousePopulation {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.houseId
   * @param {number} params.monthIndex
   * @returns {Promise<{
   *   changed: boolean,
   *   houseId?: string,
   *   pop?: number,
   *   previousPop?: number,
   *   reason?: string,
   * }>}
   */
  async execute({ houseId, monthIndex }) {
    const house = await this.repository.findById(houseId);
    if (!house) {
      return { changed: false, reason: 'house_not_found' };
    }

    const outcome = computePopulationAfterGrowth({
      type: house.type,
      currentPop: house.pop,
      roadCount: house.roadCount,
      monthIndex,
      lastPopulationGrowthMonth: house.lastPopulationGrowthMonth,
    });

    if (!outcome.changed) {
      return { changed: false, houseId, pop: house.pop, reason: outcome.reason };
    }

    await this.repository.savePopulation(houseId, {
      pop: outcome.pop,
      lastPopulationGrowthMonth: outcome.lastPopulationGrowthMonth,
    });

    return {
      changed: true,
      houseId,
      pop: outcome.pop,
      previousPop: house.pop,
      reason: outcome.reason,
    };
  }
}
