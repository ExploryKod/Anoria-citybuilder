import { describeHealthEnvironment } from '../../../domain/policies/HealthEnvironmentPolicy.js';
import { nextHealthOf } from '../../../domain/policies/HealthEvolutionPolicy.js';
import { withHealth } from '../../../../../shared/citizens/Citizen.js';
import { HEALTH_SICK_BELOW } from '../../../../../shared/population/HealthFactorCatalog.js';

/**
 * Command: once a month, bring the health of every citizen of every house a step towards the level its house's environment gives
 * (see HealthEnvironmentPolicy.js, HealthEvolutionPolicy.js). A house is judged once per month (`lastHealthMonth`), its citizens and
 * that mark written together.
 */
export class EvolveHealthOfHouses {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   * @param {import('../../../../../shared/citizens/DexieCitizenRegistry.js').DexieCitizenRegistry} citizens
   */
  constructor(housingBuildingRepository, citizens) {
    if (!citizens) throw new Error('[housing] the health evolution needs the citizens registry');
    this.repository = housingBuildingRepository;
    this.citizens = citizens;
  }

  /**
   * @param {object} params
   * @param {number} params.monthKey the month judged, counted from the first (a month is judged once)
   * @param {number} params.periodKey the month's index in its year, what the houses' records of a need are dated with
   * @returns {Promise<{ judged: number }>}
   */
  async execute({ monthKey, periodKey }) {
    const houses = await this.repository.findResidentialHouses();
    let judged = 0;
    for (const house of houses) {
      if (house.lastHealthMonth === monthKey) continue;
      const inhabitants = await this.citizens.forHouse({ houseId: house.id, hamletId: house.hamletId, pop: house.pop });
      const environment = describeHealthEnvironment(house, periodKey);
      const evolved = inhabitants.map((citizen) => withHealth(citizen, nextHealthOf(citizen, environment)));
      const sick = evolved.filter((citizen) => citizen.health < HEALTH_SICK_BELOW).length;
      await this.repository.saveHealthJudgement(house.id, { citizens: evolved, monthKey, sick });
      judged += 1;
    }
    return { judged };
  }
}
