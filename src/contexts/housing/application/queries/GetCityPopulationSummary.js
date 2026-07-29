/**
 * Query: aggregate city population across residential houses.
 */
export class GetCityPopulationSummary {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @returns {Promise<{ totalPop: number, houseCount: number }>}
   */
  async execute() {
    const houses = await this.repository.listAllResidentialSnapshots();
    const totalPop = houses.reduce((sum, house) => sum + (house.pop || 0), 0);
    return {
      totalPop,
      houseCount: houses.length,
    };
  }
}
