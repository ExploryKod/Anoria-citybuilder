/**
 * Command: evaluate and persist house evolution for every residential building.
 */
export class EvolveAllHouseBuildings {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   * @param {import('./EvolveHouseBuilding.js').EvolveHouseBuilding} evolveHouseBuilding
   */
  constructor(housingBuildingRepository, evolveHouseBuilding) {
    this.repository = housingBuildingRepository;
    this.evolveHouseBuilding = evolveHouseBuilding;
  }

  /**
   * @returns {Promise<{
   *   housesProcessed: number,
   *   housesChanged: number,
   *   changes: Array<{
   *     houseId: string,
   *     previousId: string,
   *     previousType: string,
   *     targetType: string,
   *     previousPop: number,
   *     targetPop: number,
   *     reason?: string,
   *   }>,
   * }>}
   */
  async execute() {
    const houses = await this.repository.findResidentialHouses();
    const changes = [];

    for (const house of houses) {
      const result = await this.evolveHouseBuilding.execute({ houseId: house.id });
      if (result.changed) {
        changes.push({
          houseId: result.houseId,
          previousId: result.previousId,
          previousType: result.previousType,
          targetType: result.targetType,
          previousPop: result.previousPop,
          targetPop: result.targetPop,
          reason: result.reason,
        });
      }
    }

    return {
      housesProcessed: houses.length,
      housesChanged: changes.length,
      changes,
    };
  }
}
