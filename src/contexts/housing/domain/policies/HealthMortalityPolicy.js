import { healthDeathRisk, suicideRisk } from '../../../../shared/population/HealthFactorCatalog.js';

/**
 * Who dies this month of a very poor health or takes his own life: each citizen draws, in the house's stable order, against the risk of his score (HealthFactorCatalog.js).
 * The draw is the caller's `random`, so a test can fix it.
 */

function drawn(citizens, random, riskOf) {
  if (typeof random !== 'function') throw new Error('[health] the deaths of a month need a random source');
  return citizens.filter((citizen) => {
    const risk = riskOf(citizen);
    return risk > 0 && random() < risk;
  }).map((citizen) => citizen.id);
}

/**
 * Who dies of poor physical health: each sick citizen draws once.
 * @param {ReadonlyArray<{ id: string, health: number }>} citizens the inhabitants of a house, with the health they have just reached
 * @param {() => number} random a number in [0, 1)
 * @returns {string[]} the ids of the citizens who die
 */
export function dyingAmong(citizens, random) {
  return drawn(citizens, random, (citizen) => healthDeathRisk(citizen.health));
}

/**
 * Who takes his own life: each citizen gravely ill in mind draws once (a citizen who died of his body this month is not drawn again).
 * @param {ReadonlyArray<{ id: string, mentalHealth: number }>} citizens the inhabitants of a house, with the mental health they have just reached
 * @param {() => number} random a number in [0, 1)
 * @returns {string[]} the ids of the citizens who take their own lives
 */
export function suicidesAmong(citizens, random) {
  return drawn(citizens, random, (citizen) => suicideRisk(citizen.mentalHealth));
}
