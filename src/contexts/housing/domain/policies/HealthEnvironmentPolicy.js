import {
  HEALTH_BASE_LEVEL,
  HEALTH_FACTORS,
  MENTAL_BASE_LEVEL,
  MENTAL_HEALTH_FACTORS,
  maxPointsOfFactor,
} from '../../../../shared/population/HealthFactorCatalog.js';
import { HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';
import { describeTierRequirements } from './HouseTierRequirementPolicy.js';
import { didHouseGoHungryLastConsumption } from './FamineConsequencesPolicy.js';

/**
 * The environment of a house for the health of its inhabitants: a base level plus the points of each factor the house meets (see HealthFactorCatalog.js), for the body
 * (`describeHealthEnvironment`) and for the mind (`describeMentalEnvironment`). One reading, two uses: the monthly evolution of a score takes its `level`, the histogram of
 * the house shows its `parts`; the parts always add up to the level.
 *
 * The facts are the ones the house's ladder reads (served flags, the record of each need), so `house` is a housing snapshot: its rows carry them as stored. Three facts
 * do not come from the house: the pollution (the average level of the workplaces its workers go to), the contagion (the share of the inhabitants of the houses around that
 * are sick) and the unemployment (the share of its job seekers who have no job).
 *
 * @typedef {{ workplaceExposure: number, neighbourSickShare: number, unemployedShare: number }} Around
 * @typedef {{ base: number, parts: Array<{ id: string, label: string, points: number, max: number }>, level: number }} Environment
 */

function assertAround(around) {
  const { workplaceExposure, neighbourSickShare, unemployedShare } = around ?? {};
  if (!Number.isFinite(workplaceExposure) || workplaceExposure < 0) throw new Error(`[health] the pollution of a house's workplaces must be a level from 0, got ${workplaceExposure}`);
  if (!(neighbourSickShare >= 0 && neighbourSickShare <= 1)) throw new Error(`[health] the share of sick neighbours must be a fraction, got ${neighbourSickShare}`);
  if (!(unemployedShare >= 0 && unemployedShare <= 1)) throw new Error(`[health] the share of unemployed residents must be a fraction, got ${unemployedShare}`);
  return { workplaceExposure, neighbourSickShare, unemployedShare };
}

/** @returns {Environment} */
function describeEnvironment(base, factors, house, periodKey, around) {
  if (!Number.isFinite(periodKey)) throw new Error(`[health] the environment of a house is read for a month, got ${periodKey}`);
  const { workplaceExposure, neighbourSickShare, unemployedShare } = assertAround(around);
  const outcomes = Object.fromEntries(
    factors.filter((factor) => factor.requirement?.outcomeField).map((factor) => [factor.requirement.outcomeField, house[factor.requirement.outcomeField]]),
  );
  const context = { servedFlags: house.servedFlags, lastConsumption: house.lastConsumption, outcomes, periodKey };
  const parts = factors.map((factor) => {
    let points;
    if (factor.measure === 'exposure') {
      // Takes points off, in proportion to the level the workers are exposed to.
      const levels = Math.min(workplaceExposure, factor.maxUnits);
      points = levels === 0 ? 0 : factor.pointsPerUnit * levels;
    } else if (factor.measure === 'proximity') {
      // Takes points off, in proportion to the share of sick neighbours, less where the house is covered by a doctor or a hospital.
      const covered = factor.protection.requirements.some((requirement) => describeTierRequirements([requirement], context)[0].met);
      const taken = factor.pointsAtFull * neighbourSickShare * (covered ? 1 - factor.protection.reducesBy : 1);
      points = taken === 0 ? 0 : taken;
    } else if (factor.measure === 'unemployment') {
      // Takes points off, in proportion to the share of the job seekers who have none.
      points = unemployedShare === 0 ? 0 : factor.pointsAtFull * unemployedShare;
    } else if (factor.measure === 'hunger') {
      // Takes its points off when the house went hungry at its last consumption.
      points = didHouseGoHungryLastConsumption(house.lastConsumption) ? factor.points : 0;
    } else {
      const [described] = describeTierRequirements([factor.requirement], context);
      points = factor.measure === 'met'
        ? (described.met ? factor.points : 0)
        : factor.pointsPerUnit * Math.min(described.current, factor.maxUnits);
    }
    return { id: factor.id, label: factor.label, points, max: maxPointsOfFactor(factor) };
  });
  return { base, parts, level: base + parts.reduce((sum, part) => sum + part.points, 0) };
}

/**
 * The environment of the body.
 * @param {{ servedFlags?: Record<string, number>, lastConsumption?: object | null } & Record<string, unknown>} house
 * @param {number} periodKey the month the facts must be fresh for
 * @param {Around} around see above
 * @returns {Environment}
 */
export function describeHealthEnvironment(house, periodKey, around) {
  return describeEnvironment(HEALTH_BASE_LEVEL, HEALTH_FACTORS, house, periodKey, around);
}

/**
 * The environment of the mind: culture and leisure lift it, unemployment, hunger and the nuisance of work weigh on it.
 * @param {{ servedFlags?: Record<string, number>, lastConsumption?: object | null } & Record<string, unknown>} house
 * @param {number} periodKey
 * @param {Around} around
 * @returns {Environment}
 */
export function describeMentalEnvironment(house, periodKey, around) {
  return describeEnvironment(MENTAL_BASE_LEVEL, MENTAL_HEALTH_FACTORS, house, periodKey, around);
}

/**
 * The environment as one citizen lives it: what the factors give above the base is weighed by his `sensitivity`, and when that goes
 * over the scale every part is lowered by the same share so the level stops at the top of it. The parts always add up to the level, and
 * the level is the target his health moves towards (HealthEvolutionPolicy), so his histogram is the breakdown of the real calculation.
 * It serves both environments: the base is the one of the environment given.
 *
 * @param {Environment} environment the house's environment
 * @param {{ sensitivity: number }} constitution
 * @returns {Environment}
 */
export function describeCitizenEnvironment(environment, constitution) {
  const weighed = environment.parts.map((part) => constitution.sensitivity * part.points);
  const room = HEALTH_MAX - environment.base;
  const total = weighed.reduce((sum, points) => sum + points, 0);
  const share = total > room ? room / total : 1;
  const parts = environment.parts.map((part, index) => ({ ...part, points: weighed[index] * share }));
  return { base: environment.base, parts, level: environment.base + parts.reduce((sum, part) => sum + part.points, 0) };
}
