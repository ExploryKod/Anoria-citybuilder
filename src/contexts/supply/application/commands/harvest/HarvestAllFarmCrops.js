import { FARM_HARVEST_CIRCUIT } from '../../../domain/catalogs/FoodCircuits.js';

/**
 * Orchestration: run annual harvest for every farm in the city.
 */
export class HarvestAllFarmCrops {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./ProduceResource.js').ProduceResource} produceResource
   */
  constructor(supplyBuildingRepository, produceResource) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.produceResource = produceResource;
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
      const outcome = await this.produceResource.execute({
        buildingId: farm.id,
        period: { season, year, monthIndex },
        circuit: FARM_HARVEST_CIRCUIT,
      });
      if (outcome.produced) {
        harvests.push({ ...outcome, farmId: outcome.buildingId, crop: outcome.category });
      }
    }

    return { harvestedCount: harvests.length, harvests };
  }
}
