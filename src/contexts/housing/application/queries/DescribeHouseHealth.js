import { describeCitizenEnvironment, describeHealthEnvironment } from '../../domain/policies/HealthEnvironmentPolicy.js';
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
   * @returns {Promise<{ environment: ReturnType<typeof describeHealthEnvironment>, citizenEnvironments: Record<string, ReturnType<typeof describeCitizenEnvironment>>, average: number | null, citizens: number, sick: number }>}
   *   `average` is null for a house nobody lives in; `citizenEnvironments` is the environment as each citizen lives it, by citizen id
   */
  async ofHouse({ houseId, periodKey }) {
    const house = await this.repository.findById(houseId);
    if (!house) throw new Error(`[health] house ${houseId} is not in the hamlet`);
    const inhabitants = await this.citizens.forHouse({ houseId, hamletId: house.hamletId, pop: house.pop });
    const environment = describeHealthEnvironment(house, periodKey);
    return {
      environment,
      citizenEnvironments: Object.fromEntries(inhabitants.map((citizen) => [citizen.id, describeCitizenEnvironment(environment, citizen.constitution)])),
      average: inhabitants.length === 0 ? null : inhabitants.reduce((sum, citizen) => sum + citizen.health, 0) / inhabitants.length,
      citizens: inhabitants.length,
      sick: inhabitants.filter((citizen) => citizen.health < HEALTH_SICK_BELOW).length,
    };
  }

  /**
   * The hamlet's average health, weighted by population (the sum of the scores over the inhabitants), how many there are, and the
   * hamlet's environment: each house's environment weighted by its inhabitants, so its parts add up to its level like a house's.
   * @param {{ periodKey: number }} params
   * @returns {Promise<{ average: number | null, citizens: number, sick: number, environment: ReturnType<typeof describeHealthEnvironment> | null }>}
   *   `average` and `environment` are null while nobody lives in the hamlet
   */
  async ofHamlet({ periodKey }) {
    const houses = await this.repository.findResidentialHouses();
    let sum = 0;
    let count = 0;
    let sick = 0;
    let base = null;
    const weightedPoints = new Map();
    const factors = new Map();
    for (const house of houses) {
      const inhabitants = await this.citizens.forHouse({ houseId: house.id, hamletId: house.hamletId, pop: house.pop });
      if (inhabitants.length === 0) continue;
      const environment = describeHealthEnvironment(house, periodKey);
      base = environment.base;
      for (const part of environment.parts) {
        factors.set(part.id, part);
        weightedPoints.set(part.id, (weightedPoints.get(part.id) ?? 0) + part.points * inhabitants.length);
      }
      for (const citizen of inhabitants) {
        sum += citizen.health;
        count += 1;
        if (citizen.health < HEALTH_SICK_BELOW) sick += 1;
      }
    }
    if (count === 0) return { average: null, citizens: 0, sick, environment: null };
    const parts = [...factors.values()].map((part) => ({ ...part, points: weightedPoints.get(part.id) / count }));
    const environment = { base, parts, level: base + parts.reduce((total, part) => total + part.points, 0) };
    return { average: sum / count, citizens: count, sick, environment };
  }
}
