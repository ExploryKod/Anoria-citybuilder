import { describeCitizenEnvironment, describeHealthEnvironment, describeMentalEnvironment } from '../../domain/policies/HealthEnvironmentPolicy.js';
import { surroundingsOf, surroundingsOfCitizen } from '../../domain/policies/HealthSurroundingsPolicy.js';
import { CONTAGION_RADIUS, HEALTH_SEVERE_BELOW, HEALTH_SICK_BELOW } from '../../../../shared/population/HealthFactorCatalog.js';
import { houseIsOutsideHealth, residentsSeekingWork } from '../../../../shared/population/workforceQueries.js';

/** How many of the given scores are mildly ill (under the sick threshold, not under the severe one) and how many gravely. */
function illnessOf(scores) {
  return {
    mild: scores.filter((score) => score < HEALTH_SICK_BELOW && score >= HEALTH_SEVERE_BELOW).length,
    severe: scores.filter((score) => score < HEALTH_SEVERE_BELOW).length,
  };
}

/** The readings of a house's surroundings that do not come from the house itself (see HealthSurroundingsPolicy.js). */
function surroundingsOfHouse(house, workplaces, neighbours) {
  return surroundingsOf({ pop: house.pop, seeking: residentsSeekingWork(house.type, house.pop) }, workplaces.get(house.id), neighbours.get(house.id));
}

/** The environments of a set of houses weighted by their inhabitants, so the parts add up to the level like a house's. */
function averageEnvironment(weighted, count) {
  if (count === 0) return null;
  const parts = [...weighted.parts.values()].map((part) => ({ ...part, points: weighted.points.get(part.id) / count }));
  return { base: weighted.base, parts, level: weighted.base + parts.reduce((total, part) => total + part.points, 0) };
}

/**
 * Query: the health of one house and of the whole hamlet, of the body and of the mind. The house's environments are the same readings the monthly evolution takes
 * their levels from (HealthEnvironmentPolicy.js), so the histograms they feed are the breakdown of the real calculation. Averages are derived at each reading from the
 * citizens, never stored.
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
   * @returns {Promise<{
   *   environment: ReturnType<typeof describeHealthEnvironment>, mentalEnvironment: ReturnType<typeof describeMentalEnvironment>,
   *   citizenEnvironments: Record<string, ReturnType<typeof describeCitizenEnvironment>>, citizenMentalEnvironments: Record<string, ReturnType<typeof describeCitizenEnvironment>>,
   *   average: number | null, mentalAverage: number | null, citizens: number, sick: number,
   * }>}
   *   the averages are null for a house nobody lives in; the citizen environments are the environments as each citizen lives them, by citizen id
   */
  async ofHouse({ houseId, periodKey }) {
    const house = await this.repository.findById(houseId);
    if (!house) throw new Error(`[health] house ${houseId} is not in the hamlet`);
    // The administrators' house stands outside health: it has no score, no environment and no illness to describe, and the screen says so.
    if (houseIsOutsideHealth(house.type)) return { outsideHealth: true };
    const inhabitants = await this.citizens.forHouse({ houseId, hamletId: house.hamletId, pop: house.pop });
    const workplaces = await this.repository.workplaceExposureByHouse();
    const neighbours = await this.repository.neighbourSickByHouse(CONTAGION_RADIUS);
    const around = surroundingsOfHouse(house, workplaces, neighbours);
    // The house's own reading is the average over its residents; each citizen lives the one of his situation (unemployment weighs only on those with no job, the pollution
    // of work only on those who work, by the level of his own workplace), as the monthly evolution reads it.
    const environment = describeHealthEnvironment(house, periodKey, around);
    const mentalEnvironment = describeMentalEnvironment(house, periodKey, around);
    const pollution = await this.repository.pollutionByWorkplace();
    const seeking = residentsSeekingWork(house.type, house.pop);
    const variants = new Map();
    const variantOf = (citizen) => {
      const own = surroundingsOfCitizen(citizen, seeking, neighbours.get(houseId), pollution);
      const key = `${own.workplaceExposure}|${own.unemployedShare}`;
      if (!variants.has(key)) variants.set(key, { body: describeHealthEnvironment(house, periodKey, own), mind: describeMentalEnvironment(house, periodKey, own) });
      return variants.get(key);
    };
    const averageOf = (field) => (inhabitants.length === 0 ? null : inhabitants.reduce((sum, citizen) => sum + citizen[field], 0) / inhabitants.length);
    return {
      environment,
      mentalEnvironment,
      citizenEnvironments: Object.fromEntries(inhabitants.map((citizen) => [citizen.id, describeCitizenEnvironment(variantOf(citizen).body, citizen.constitution)])),
      citizenMentalEnvironments: Object.fromEntries(inhabitants.map((citizen) => [citizen.id, describeCitizenEnvironment(variantOf(citizen).mind, citizen.constitution)])),
      average: averageOf('health'),
      mentalAverage: averageOf('mentalHealth'),
      citizens: inhabitants.length,
      sick: inhabitants.filter((citizen) => citizen.health < HEALTH_SICK_BELOW || citizen.mentalHealth < HEALTH_SICK_BELOW).length,
    };
  }

  /**
   * How many citizens of the hamlet are ill and how gravely, in the body and in the mind: the HUD's four counts. A light reading, from the scores alone (no environment is
   * described), so the screen can ask for it every turn.
   * @returns {Promise<{ physical: { mild: number, severe: number }, mental: { mild: number, severe: number } }>}
   */
  async illnessOfHamlet() {
    const bodies = [];
    const minds = [];
    for (const house of await this.repository.findResidentialHouses()) {
      if (houseIsOutsideHealth(house.type)) continue;
      for (const citizen of await this.citizens.forHouse({ houseId: house.id, hamletId: house.hamletId, pop: house.pop })) {
        bodies.push(citizen.health);
        minds.push(citizen.mentalHealth);
      }
    }
    return { physical: illnessOf(bodies), mental: illnessOf(minds) };
  }

  /**
   * The hamlet's average health and mental health, weighted by population (the sum of the scores over the inhabitants), how many there are, how many are sick, how many are
   * ill and how gravely in the body and in the mind (the HUD's four counts), and the hamlet's environments: each house's weighted by its inhabitants, so its parts add up to
   * its level like a house's.
   * @param {{ periodKey: number }} params
   * @returns {Promise<{
   *   average: number | null, mentalAverage: number | null, citizens: number, sick: number,
   *   illness: { physical: { mild: number, severe: number }, mental: { mild: number, severe: number } },
   *   environment: ReturnType<typeof describeHealthEnvironment> | null, mentalEnvironment: ReturnType<typeof describeMentalEnvironment> | null,
   * }>}
   *   the averages and the environments are null while nobody lives in the hamlet
   */
  async ofHamlet({ periodKey }) {
    const houses = await this.repository.findResidentialHouses();
    const workplaces = await this.repository.workplaceExposureByHouse();
    const neighbours = await this.repository.neighbourSickByHouse(CONTAGION_RADIUS);
    let count = 0;
    let sick = 0;
    const bodies = [];
    const minds = [];
    const physical = { base: null, parts: new Map(), points: new Map() };
    const mental = { base: null, parts: new Map(), points: new Map() };
    const add = (target, environment, weight) => {
      target.base = environment.base;
      for (const part of environment.parts) {
        target.parts.set(part.id, part);
        target.points.set(part.id, (target.points.get(part.id) ?? 0) + part.points * weight);
      }
    };
    for (const house of houses) {
      if (houseIsOutsideHealth(house.type)) continue;
      const inhabitants = await this.citizens.forHouse({ houseId: house.id, hamletId: house.hamletId, pop: house.pop });
      if (inhabitants.length === 0) continue;
      const around = surroundingsOfHouse(house, workplaces, neighbours);
      add(physical, describeHealthEnvironment(house, periodKey, around), inhabitants.length);
      add(mental, describeMentalEnvironment(house, periodKey, around), inhabitants.length);
      for (const citizen of inhabitants) {
        bodies.push(citizen.health);
        minds.push(citizen.mentalHealth);
        count += 1;
        if (citizen.health < HEALTH_SICK_BELOW || citizen.mentalHealth < HEALTH_SICK_BELOW) sick += 1;
      }
    }
    const illness = { physical: illnessOf(bodies), mental: illnessOf(minds) };
    if (count === 0) return { average: null, mentalAverage: null, citizens: 0, sick, illness, environment: null, mentalEnvironment: null };
    const mean = (scores) => scores.reduce((sum, score) => sum + score, 0) / count;
    return {
      average: mean(bodies),
      mentalAverage: mean(minds),
      citizens: count,
      sick,
      illness,
      environment: averageEnvironment(physical, count),
      mentalEnvironment: averageEnvironment(mental, count),
    };
  }
}
