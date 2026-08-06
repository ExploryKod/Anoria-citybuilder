import { computeCityFoodSupply } from '../../domain/policies/CityFoodSupplyPolicy.js';

/**
 * Query: city-wide food stored in houses (gathering + market channels).
 */
export class GetCityFoodSupply {
  /**
   * @param {import('../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.housingBuildingRepository = housingBuildingRepository;
  }

  /** @returns {Promise<ReturnType<typeof computeCityFoodSupply>>} */
  async execute() {
    const houses = await this.housingBuildingRepository.listAllResidentialSnapshots();
    return computeCityFoodSupply(houses);
  }
}
