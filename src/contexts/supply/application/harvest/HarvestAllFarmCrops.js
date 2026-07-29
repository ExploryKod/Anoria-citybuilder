/**
 * Orchestration: run annual harvest for every farm in the city.
 */
export class HarvestAllFarmCrops {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./HarvestFarmCrop.js').HarvestFarmCrop} harvestFarmCrop
   */
  constructor(supplyBuildingRepository, harvestFarmCrop) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.harvestFarmCrop = harvestFarmCrop;
  }

  /**
   * @param {object} params
   * @param {string} params.season
   * @param {number} params.year
   * @param {number} [params.monthIndex]
   * @returns {Promise<{ harvestedCount: number, harvests: object[] }>}
   */
  async execute({ season, year, monthIndex = null }) {
    const farms = await this.supplyBuildingRepository.findFarms();
    const harvests = [];

    for (const farm of farms) {
      const outcome = await this.harvestFarmCrop.execute({
        farmId: farm.id,
        season,
        year,
        monthIndex,
      });
      if (outcome.harvested) {
        harvests.push(outcome);
      }
    }

    return { harvestedCount: harvests.length, harvests };
  }
}
