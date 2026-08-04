import { isPalaceHouseType } from '../../domain/policies/HouseCapacityPolicy.js';

/**
 * Command: zero out population on Palace houses without road access.
 * Legacy safety net for the frozen Palace path (`HouseEvolutionPolicy`) only
 * — Blue/Red/Purple houses are level-based now: level 1 is autarkic by
 * design (no road needed) and level 2's road loss is handled by
 * `HouseLevelPolicy` (demotion + population clamp, not a hard reset to 0).
 */
export class ClearPopulationWithoutRoadAccess {
  /**
   * @param {import('../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.housingBuildingRepository = housingBuildingRepository;
  }

  /**
   * @returns {Promise<{
   *   totalPopulationLost: number,
   *   totalPopulationGained: number,
   *   housesAffected: number,
   *   message: string,
   * }>}
   */
  async execute() {
    const houses = await this.housingBuildingRepository.findResidentialHouses();
    let totalPopulationLost = 0;
    let housesAffected = 0;

    for (const house of houses) {
      if (!isPalaceHouseType(house.type)) continue;

      const hasRoadAccess = (house.roadCount ?? 0) > 0;
      const currentPop = house.pop || 0;

      if (!hasRoadAccess && currentPop > 0) {
        totalPopulationLost += currentPop;
        housesAffected++;
        await this.housingBuildingRepository.savePopulation(house.id, { pop: 0 });
      }
    }

    return {
      totalPopulationLost,
      totalPopulationGained: 0,
      housesAffected,
      message: totalPopulationLost > 0
        ? `${totalPopulationLost} inhabitants lost due to no road access in ${housesAffected} houses`
        : 'All houses with population have road access',
    };
  }
}
