import { HEALTH_MIN, HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';

/**
 * The health of a citizen after a month: it moves towards the level its environment allows, by the share its constitution sets
 * (`convergence`), and never past it, so it settles instead of piling up or collapsing. What the factors give above the base is
 * weighed by the citizen's `sensitivity`; the base is the same for everyone. The target and the result stay within the scale.
 *
 * @param {{ health: number, constitution: { convergence: number, sensitivity: number } }} citizen
 * @param {{ base: number, level: number }} environment see HealthEnvironmentPolicy.js
 * @returns {number}
 */
export function nextHealthOf(citizen, environment) {
  const target = Math.min(HEALTH_MAX, Math.max(HEALTH_MIN, environment.base + citizen.constitution.sensitivity * (environment.level - environment.base)));
  return citizen.health + citizen.constitution.convergence * (target - citizen.health);
}
