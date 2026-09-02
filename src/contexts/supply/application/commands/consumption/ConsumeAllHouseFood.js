import { HOUSE_FOOD_CONSUMPTION_CIRCUIT } from '../../../domain/catalogs/FoodCircuits.js';

/**
 * Orchestration: monthly food consumption for every house in the city.
 */
export class ConsumeAllHouseFood {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./ConsumeResource.js').ConsumeResource} consumeResource
   */
  constructor(supplyBuildingRepository, consumeResource) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.consumeResource = consumeResource;
  }

  /**
   * @param {object} params
   * @param {number} params.monthIndex
   * @returns {Promise<{ consumedCount: number, consumptions: object[] }>}
   */
  async execute({ monthIndex }) {
    const houses = await this.supplyBuildingRepository.findHouses();
    const consumptions = [];

    for (const house of houses) {
      const outcome = await this.consumeResource.execute({
        buildingId: house.id,
        period: { monthIndex },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
      });
      if (outcome.consumed) {
        consumptions.push({ ...outcome, houseId: outcome.buildingId });
      }
    }

    return { consumedCount: consumptions.length, consumptions };
  }
}
