import { describeHealthEnvironment, describeMentalEnvironment } from '../../../domain/policies/HealthEnvironmentPolicy.js';
import { nextHealthOf, nextMentalHealthOf } from '../../../domain/policies/HealthEvolutionPolicy.js';
import { dyingAmong, suicidesAmong } from '../../../domain/policies/HealthMortalityPolicy.js';
import { invalidityAfter, isInvalid } from '../../../domain/policies/InvalidityPolicy.js';
import { withHealth, withInvalidity, withMentalHealth } from '../../../../../shared/citizens/Citizen.js';
import { surroundingsOfCitizen } from '../../../domain/policies/HealthSurroundingsPolicy.js';
import { CONTAGION_RADIUS, HEALTH_SICK_BELOW } from '../../../../../shared/population/HealthFactorCatalog.js';
import { houseInvalidityRule, houseIsOutsideHealth, residentsSeekingWork } from '../../../../../shared/population/workforceQueries.js';

/**
 * Command: once a month, bring the body and the mind of every citizen of every house a step towards the level their house's environment gives
 * (see HealthEnvironmentPolicy.js, HealthEvolutionPolicy.js), note who has now been gravely ill long enough to be invalid (InvalidityPolicy.js), then, where the game has
 * defeat, let the sick die and the gravely depressed take their own lives, by the risk of their score (HealthMortalityPolicy.js). A house is judged once per month
 * (`lastHealthMonth`), its citizens, its deaths and that mark written together.
 */
export class EvolveHealthOfHouses {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   * @param {import('../../../../../shared/citizens/DexieCitizenRegistry.js').DexieCitizenRegistry} citizens
   * @param {() => number} random the draw of the deaths, in [0, 1): the composition's to give
   */
  constructor(housingBuildingRepository, citizens, random) {
    if (!citizens) throw new Error('[housing] the health evolution needs the citizens registry');
    if (typeof random !== 'function') throw new Error('[housing] the health evolution needs its random source for the deaths');
    this.repository = housingBuildingRepository;
    this.citizens = citizens;
    this.random = random;
  }

  /**
   * @param {object} params
   * @param {number} params.monthKey the month judged, counted from the first (a month is judged once)
   * @param {number} params.periodKey the month's index in its year, what the houses' records of a need are dated with
   * @param {boolean} params.deathsEnabled whether poor health kills in this game (the mode that has defeat, like the famine)
   * @returns {Promise<{ judged: number, deaths: number, suicides: number }>} `deaths`: the citizens who died of poor physical health this month; `suicides`: those who took their own lives
   */
  async execute({ monthKey, periodKey, deathsEnabled }) {
    if (typeof deathsEnabled !== 'boolean') throw new Error(`[health] whether poor health kills must be told, got ${deathsEnabled}`);
    const houses = await this.repository.findResidentialHouses();
    // What does not come from the house itself, read once for the month: the pollution of every workplace and the sick of the houses around.
    const pollution = await this.repository.pollutionByWorkplace();
    const neighbours = await this.repository.neighbourSickByHouse(CONTAGION_RADIUS);
    let judged = 0;
    let deaths = 0;
    let suicides = 0;
    for (const house of houses) {
      if (house.lastHealthMonth === monthKey) continue;
      // The administrators stand outside health: their house is never judged (no score moves, no one falls ill, is invalid or dies).
      if (houseIsOutsideHealth(house.type)) continue;
      const inhabitants = await this.citizens.forHouse({ houseId: house.id, hamletId: house.hamletId, pop: house.pop });
      // The surroundings weigh differently on each citizen: unemployment only on those who have no job, the pollution of work only on those who work, and by the level of the
      // very workplace he works at. The environments are read once per distinct situation of the house.
      const seeking = residentsSeekingWork(house.type, house.pop);
      const environments = new Map();
      const environmentOf = (citizen) => {
        const around = surroundingsOfCitizen(citizen, seeking, neighbours.get(house.id), pollution);
        const key = `${around.workplaceExposure}|${around.unemployedShare}`;
        if (!environments.has(key)) {
          environments.set(key, { body: describeHealthEnvironment(house, periodKey, around), mind: describeMentalEnvironment(house, periodKey, around) });
        }
        return environments.get(key);
      };
      const rule = houseInvalidityRule(house.type);
      const evolved = inhabitants.map((citizen) => {
        const { body, mind } = environmentOf(citizen);
        const health = nextHealthOf(citizen, body);
        const mentalHealth = nextMentalHealthOf(citizen, mind);
        // A grave illness of either, the body's or the mind's, counts towards invalidity.
        return withInvalidity(withMentalHealth(withHealth(citizen, health), mentalHealth), invalidityAfter(citizen, Math.min(health, mentalHealth), rule));
      });
      // Poor health kills, and a gravely ill mind ends in suicide, where the game has defeat.
      const dying = deathsEnabled ? dyingAmong(evolved, this.random) : [];
      const dyingIds = new Set(dying);
      const taking = deathsEnabled ? suicidesAmong(evolved.filter((citizen) => !dyingIds.has(citizen.id)), this.random) : [];
      const gone = new Set([...dying, ...taking]);
      const survivors = evolved.filter((citizen) => !gone.has(citizen.id));
      const invalid = survivors.filter((citizen) => isInvalid(citizen, rule)).length;
      const sick = survivors.filter((citizen) => (citizen.health < HEALTH_SICK_BELOW || citizen.mentalHealth < HEALTH_SICK_BELOW) && !isInvalid(citizen, rule)).length;
      await this.repository.saveHealthJudgement(house.id, { citizens: evolved, monthKey, sick, invalid, deaths: [...gone] });
      judged += 1;
      deaths += dying.length;
      suicides += taking.length;
    }
    return { judged, deaths, suicides };
  }
}
