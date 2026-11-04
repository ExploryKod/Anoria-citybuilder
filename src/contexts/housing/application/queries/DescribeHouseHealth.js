import { describeHealthEnvironment } from '../../domain/policies/HealthEnvironmentPolicy.js';
import { HEALTH_SICK_BELOW } from '../../../../shared/population/HealthFactorCatalog.js';

/**
 * Query: the health of one house and of the whole hamlet. The house's environment is the same reading the monthly evolution takes
 * its level from (HealthEnvironmentPolicy.js), so the histogram it feeds is the breakdown of the real calculation. Averages are
 * derived at each reading from the citizens, never stored.
 */
export class DescribeHouseHealth {
  /**
   * @param {import('../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   * @param {import('../../../../shared/citizens/DexieCitizenRegistry.js').DexieCitizenRegistry} citizens
   */
  constructor(housingBuildingRepository, citizens) {
    if (!citizens) throw new Error('[housing] the health query needs the citizens registry');
    this.repository = housingBuildingRepository;
    this.citizens = citizens;
  }

  /**
   * @param {{ houseId: string, periodKey: number }} params
   * @returns {Promise<{ environment: ReturnType<typeof describeHealthEnvironment>, average: number | null, citizens: number }>}
   *   `average` is null for a house nobody lives in
   */
  async ofHouse({ houseId, periodKey }) {
    const house = await this.repository.findById(houseId);
    if (!house) throw new Error(`[health] house ${houseId} is not in the hamlet`);
    const inhabitants = await this.citizens.forHouse({ houseId, hamletId: house.hamletId, pop: house.pop });
    return {
      environment: describeHealthEnvironment(house, periodKey),
      average: inhabitants.length === 0 ? null : inhabitants.reduce((sum, citizen) => sum + citizen.health, 0) / inhabitants.length,
      citizens: inhabitants.length,
      sick: inhabitants.filter((citizen) => citizen.health < HEALTH_SICK_BELOW).length,
    };
  }

  /**
   * The hamlet's average health, weighted by population (the sum of the scores over the inhabitants), and how many there are.
   * @returns {Promise<{ average: number | null, citizens: number }>} `average` is null while nobody lives in the hamlet
   */
  async ofHamlet() {
    const houses = await this.repository.findResidentialHouses();
    let sum = 0;
    let count = 0;
    let sick = 0;
    for (const house of houses) {
      for (const citizen of await this.citizens.forHouse({ houseId: house.id, hamletId: house.hamletId, pop: house.pop })) {
        sum += citizen.health;
        count += 1;
        if (citizen.health < HEALTH_SICK_BELOW) sick += 1;
      }
    }
    return { average: count === 0 ? null : sum / count, citizens: count, sick };
  }
}
