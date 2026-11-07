import { describeCitizenEnvironment } from './HealthEnvironmentPolicy.js';

/**
 * The health of a citizen after a month: it moves towards the level its environment allows, by the share its constitution sets
 * (`convergence`), and never past it, so it settles instead of piling up or collapsing. What the factors give above the base is
 * weighed by the citizen's `sensitivity`; the base is the same for everyone (see `describeCitizenEnvironment`, which the citizen's
 * histogram also reads). The target and the result stay within the scale. The same move serves the body (`nextHealthOf`) and the mind (`nextMentalHealthOf`).
 *
 * @param {{ health: number, constitution: { convergence: number, sensitivity: number } }} citizen
 * @param {{ base: number, level: number }} environment see HealthEnvironmentPolicy.js
 * @returns {number}
 */
export function nextHealthOf(citizen, environment) {
  return moveTowards(citizen.health, citizen.constitution, environment);
}

/**
 * @param {{ mentalHealth: number, constitution: { convergence: number, sensitivity: number } }} citizen
 * @param {{ base: number, level: number }} environment the environment of the mind
 * @returns {number}
 */
export function nextMentalHealthOf(citizen, environment) {
  return moveTowards(citizen.mentalHealth, citizen.constitution, environment);
}

function moveTowards(score, constitution, environment) {
  const target = describeCitizenEnvironment(environment, constitution).level;
  return score + constitution.convergence * (target - score);
}
