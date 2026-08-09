/**
 * Command: apply monthly population growth for every residential house.
 */
export class GrowAllHousePopulation {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   * @param {import('./GrowHousePopulation.js').GrowHousePopulation} growHousePopulation
   */
  constructor(housingBuildingRepository, growHousePopulation) {
    this.repository = housingBuildingRepository;
    this.growHousePopulation = growHousePopulation;
  }

  /**
   * @param {object} params
   * @param {number} params.monthIndex
   * @param {boolean} [params.applyFamineLimits=false]
   * @returns {Promise<{
   *   housesProcessed: number,
   *   housesChanged: number,
   *   deaths: number,
   *   changes: Array<{ houseId: string, pop: number, previousPop: number, reason?: string, deaths?: number }>,
   * }>}
   */
  async execute({ monthIndex, applyFamineLimits = false }) {
    const houses = await this.repository.findResidentialHouses();
    const changes = [];
    let deaths = 0;

    for (const house of houses) {
      const result = await this.growHousePopulation.execute({
        houseId: house.id,
        monthIndex,
        applyFamineLimits,
      });

      deaths += result.deaths ?? 0;

      if (result.changed) {
        changes.push({
          houseId: result.houseId,
          pop: result.pop,
          previousPop: result.previousPop,
          reason: result.reason,
          deaths: result.deaths ?? 0,
        });
      }
    }

    return {
      housesProcessed: houses.length,
      housesChanged: changes.length,
      deaths,
      changes,
    };
  }
}
