import { HEALTH_BASE_LEVEL, HEALTH_FACTORS, maxPointsOfFactor } from '../../../../shared/population/HealthFactorCatalog.js';
import { HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';
import { describeTierRequirements } from './HouseTierRequirementPolicy.js';

/**
 * The environment of a house for the health of its inhabitants: the base level plus the points of each factor the house meets
 * (see HealthFactorCatalog.js). One reading, two uses: the monthly evolution of health takes its `level`, the histogram of the house
 * shows its `parts`; the parts always add up to the level.
 *
 * The facts are the ones the house's ladder reads (served flags, the record of each need), so `house` is a housing snapshot: its
 * rows carry them as stored.
 *
 * @param {{ servedFlags?: Record<string, number>, lastConsumption?: object | null } & Record<string, unknown>} house
 * @param {number} periodKey the month the facts must be fresh for
 * @returns {{ base: number, parts: Array<{ id: string, label: string, points: number, max: number }>, level: number }}
 */
export function describeHealthEnvironment(house, periodKey) {
  if (!Number.isFinite(periodKey)) throw new Error(`[health] the environment of a house is read for a month, got ${periodKey}`);
  const outcomes = Object.fromEntries(
    HEALTH_FACTORS.filter((factor) => factor.requirement.outcomeField).map((factor) => [factor.requirement.outcomeField, house[factor.requirement.outcomeField]]),
  );
  const context = { servedFlags: house.servedFlags, lastConsumption: house.lastConsumption, outcomes, periodKey };
  const parts = HEALTH_FACTORS.map((factor) => {
    const [described] = describeTierRequirements([factor.requirement], context);
    const points = factor.measure === 'met'
      ? (described.met ? factor.points : 0)
      : factor.pointsPerUnit * Math.min(described.current, factor.maxUnits);
    return { id: factor.id, label: factor.label, points, max: maxPointsOfFactor(factor) };
  });
  return { base: HEALTH_BASE_LEVEL, parts, level: HEALTH_BASE_LEVEL + parts.reduce((sum, part) => sum + part.points, 0) };
}

/**
 * The environment as one citizen lives it: what the factors give above the base is weighed by his `sensitivity`, and when that goes
 * over the scale every part is lowered by the same share so the level stops at the top of it. The parts always add up to the level, and
 * the level is the target his health moves towards (HealthEvolutionPolicy), so his histogram is the breakdown of the real calculation.
 *
 * @param {ReturnType<typeof describeHealthEnvironment>} environment the house's environment
 * @param {{ sensitivity: number }} constitution
 * @returns {{ base: number, parts: Array<{ id: string, label: string, points: number, max: number }>, level: number }}
 */
export function describeCitizenEnvironment(environment, constitution) {
  const weighed = environment.parts.map((part) => constitution.sensitivity * part.points);
  const room = HEALTH_MAX - environment.base;
  const total = weighed.reduce((sum, points) => sum + points, 0);
  const share = total > room ? room / total : 1;
  const parts = environment.parts.map((part, index) => ({ ...part, points: weighed[index] * share }));
  return { base: environment.base, parts, level: environment.base + parts.reduce((sum, part) => sum + part.points, 0) };
}
