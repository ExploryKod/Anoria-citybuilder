/**
 * Command: zero out population on residential houses without road access.
 * Legacy safety net — ECS growth also enforces no-road → pop 0.
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
