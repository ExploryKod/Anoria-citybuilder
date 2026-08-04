/**
 * Orchestration: monthly subsistence food production for every level 1
 * (autarky) house in the city.
 */
export class ProduceAllHouseSubsistenceFood {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./ProduceHouseSubsistenceFood.js').ProduceHouseSubsistenceFood} produceHouseSubsistenceFood
   */
  constructor(supplyBuildingRepository, produceHouseSubsistenceFood) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.produceHouseSubsistenceFood = produceHouseSubsistenceFood;
  }

  /**
   * @param {object} params
   * @param {number} params.monthIndex
   * @returns {Promise<{ producedCount: number, productions: object[] }>}
   */
  async execute({ monthIndex }) {
    const houses = await this.supplyBuildingRepository.findHouses();
    const productions = [];

    for (const house of houses) {
      const outcome = await this.produceHouseSubsistenceFood.execute({
        houseId: house.id,
        monthIndex,
      });
      if (outcome.produced) {
        productions.push(outcome);
      }
    }

    return { producedCount: productions.length, productions };
  }
}
