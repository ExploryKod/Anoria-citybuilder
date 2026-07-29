import {
  HOUSE_TYPE_BLUE,
  HOUSE_TYPE_RED,
  HOUSE_TYPE_PURPLE,
  HOUSE_TYPE_PALACE,
  normalizeResidentialType,
} from '../HouseTypeCatalog.js';
import { isPalaceHouseType, HOUSE_CITIZEN_CAP } from './HouseCapacityPolicy.js';
import {
  checkFoodAffluence,
  countAvailableCropTypes,
} from './FoodAffluencePolicy.js';

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * @param {string} type
 * @param {number} pop
 * @returns {number}
 */
export function elitePopFromHouse(type, pop) {
  const p = clampPop(pop);
  if (p <= 0 || !isPalaceHouseType(type)) return 0;
  return Math.max(0, p - HOUSE_CITIZEN_CAP);
}

/**
 * @param {number} currentPop
 * @returns {number}
 */
export function popAfterPalaceEvolution(currentPop) {
  return clampPop(currentPop) + 1;
}

/**
 * @param {string} palaceType
 * @param {number} currentPop
 * @returns {number}
 */
export function popAfterPalaceRegression(palaceType, currentPop) {
  const p = clampPop(currentPop);
  return Math.max(0, p - elitePopFromHouse(palaceType, p));
}

/**
 * @param {object} params
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} params.stocks
 * @param {number} params.population
 * @param {string} params.buildingType
 * @param {boolean} params.hasRoadAccess
 * @returns {{ canEvolve: boolean, reason?: string }}
 */
export function canEvolveToPurple({
  stocks,
  population,
  buildingType,
  hasRoadAccess,
}) {
  if (normalizeResidentialType(buildingType) !== HOUSE_TYPE_RED) {
    return { canEvolve: false, reason: 'not_house_red' };
  }

  if (population <= 0) {
    return { canEvolve: false, reason: 'not_inhabited' };
  }

  if (!hasRoadAccess) {
    return { canEvolve: false, reason: 'no_road_access' };
  }

  if (population <= 5) {
    return { canEvolve: false, reason: 'population_too_low' };
  }

  const { totalFood } = checkFoodAffluence(stocks, population);
  if (totalFood < population) {
    return { canEvolve: false, reason: 'hunger_present' };
  }

  return { canEvolve: true };
}

/**
 * @param {object} params
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} params.stocks
 * @param {number} params.population
 * @param {string} params.buildingType
 * @returns {{ canEvolve: boolean, reason?: string }}
 */
export function canEvolveToPalace({ stocks, population, buildingType }) {
  if (normalizeResidentialType(buildingType) !== HOUSE_TYPE_PURPLE) {
    return { canEvolve: false, reason: 'not_house_purple' };
  }

  const { meetsFoodGoal } = checkFoodAffluence(stocks, population);
  if (!meetsFoodGoal) {
    return { canEvolve: false, reason: 'food_goal_not_met' };
  }

  if (countAvailableCropTypes(stocks) < 2) {
    return { canEvolve: false, reason: 'insufficient_food_variety' };
  }

  return { canEvolve: true };
}

/**
 * Resolve the target house type and population after evolution/regression rules.
 *
 * @param {object} params
 * @param {string} params.type
 * @param {number} params.pop
 * @param {number} params.roadCount
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} params.stocks
 * @returns {{
 *   targetType: string,
 *   targetPop: number,
 *   previousType: string,
 *   previousPop: number,
 *   changed: boolean,
 *   reason?: string,
 * }}
 */
export function resolveHouseEvolution({ type, pop, roadCount, stocks }) {
  const previousType = normalizeResidentialType(type);
  const previousPop = clampPop(pop);
  const hasRoadAccess = (roadCount ?? 0) > 0;

  let targetType = previousType;
  let targetPop = previousPop;
  let reason;

  if (previousType === HOUSE_TYPE_BLUE && previousPop > 0) {
    targetType = HOUSE_TYPE_RED;
    reason = 'blue_to_red';
  } else if (previousType === HOUSE_TYPE_RED && previousPop === 0) {
    targetType = HOUSE_TYPE_BLUE;
    reason = 'red_to_blue';
  } else if (previousType === HOUSE_TYPE_RED) {
    const purpleCheck = canEvolveToPurple({
      stocks,
      population: previousPop,
      buildingType: HOUSE_TYPE_RED,
      hasRoadAccess,
    });
    if (purpleCheck.canEvolve) {
      targetType = HOUSE_TYPE_PURPLE;
      reason = 'red_to_purple';
    }
  } else if (previousType === HOUSE_TYPE_PURPLE) {
    const purpleCheck = canEvolveToPurple({
      stocks,
      population: previousPop,
      buildingType: HOUSE_TYPE_RED,
      hasRoadAccess,
    });
    if (!purpleCheck.canEvolve) {
      targetType = HOUSE_TYPE_RED;
      reason = 'purple_to_red';
    }
  }

  if (targetType === HOUSE_TYPE_PURPLE) {
    const palaceCheck = canEvolveToPalace({
      stocks,
      population: previousPop,
      buildingType: HOUSE_TYPE_PURPLE,
    });
    if (palaceCheck.canEvolve) {
      targetType = HOUSE_TYPE_PALACE;
      targetPop = popAfterPalaceEvolution(previousPop);
      reason = 'purple_to_palace';
    }
  }

  if (previousType === HOUSE_TYPE_PALACE) {
    const palaceCheck = canEvolveToPalace({
      stocks,
      population: previousPop,
      buildingType: HOUSE_TYPE_PURPLE,
    });
    if (!palaceCheck.canEvolve) {
      if (previousPop === 0) {
        targetType = HOUSE_TYPE_BLUE;
        reason = 'palace_to_blue';
      } else {
        const purpleCheck = canEvolveToPurple({
          stocks,
          population: previousPop,
          buildingType: HOUSE_TYPE_RED,
          hasRoadAccess,
        });
        targetType = purpleCheck.canEvolve ? HOUSE_TYPE_PURPLE : HOUSE_TYPE_RED;
        reason = purpleCheck.canEvolve ? 'palace_to_purple' : 'palace_to_red';
      }
      targetPop = popAfterPalaceRegression(HOUSE_TYPE_PALACE, previousPop);
    }
  }

  const changed = targetType !== previousType || targetPop !== previousPop;

  return {
    targetType,
    targetPop,
    previousType,
    previousPop,
    changed,
    reason,
  };
}
