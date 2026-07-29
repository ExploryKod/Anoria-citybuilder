/**
 * Orchestration: monthly food consumption for every house in the city.
 */
export class ConsumeAllHouseFood {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./ConsumeHouseFood.js').ConsumeHouseFood} consumeHouseFood
   */
  constructor(supplyBuildingRepository, consumeHouseFood) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.consumeHouseFood = consumeHouseFood;
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
      const outcome = await this.consumeHouseFood.execute({
        houseId: house.id,
        monthIndex,
      });
      if (outcome.consumed) {
        consumptions.push(outcome);
      }
    }

    return { consumedCount: consumptions.length, consumptions };
  }
}
