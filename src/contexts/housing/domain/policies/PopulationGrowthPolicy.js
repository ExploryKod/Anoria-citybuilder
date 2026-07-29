import {
  isResidentialHouseType,
  maxPopulationForHouseType,
} from './HouseCapacityPolicy.js';

/**
 * Compute next population for a residential house at a monthly tick.
 *
 * @param {object} params
 * @param {string} params.type
 * @param {number} params.currentPop
 * @param {number} params.roadCount
 * @param {number} params.monthIndex
 * @param {number | null} [params.lastPopulationGrowthMonth=null]
 * @returns {{
 *   pop: number,
 *   changed: boolean,
 *   lastPopulationGrowthMonth?: number | null,
 *   reason?: string,
 * }}
 */
export function computePopulationAfterGrowth({
  type,
  currentPop,
  roadCount,
  monthIndex,
  lastPopulationGrowthMonth = null,
}) {
  const pop = Number.isFinite(currentPop) ? Math.max(0, Math.floor(currentPop)) : 0;

  if (!isResidentialHouseType(type)) {
    return { pop, changed: false, reason: 'not_residential' };
  }

  const maxPopulation = maxPopulationForHouseType(type);
  const hasRoadAccess = (roadCount ?? 0) > 0;

  if (!hasRoadAccess) {
    if (pop > 0) {
      return { pop: 0, changed: true, reason: 'no_road_access' };
    }
    return { pop: 0, changed: false, reason: 'no_road_access' };
  }

  if (maxPopulation <= 0) {
    return { pop, changed: false };
  }

  if (pop > maxPopulation) {
    return {
      pop: maxPopulation,
      changed: true,
      lastPopulationGrowthMonth,
      reason: 'cap_exceeded',
    };
  }

  if (pop < maxPopulation && lastPopulationGrowthMonth !== monthIndex) {
    const nextPop = Math.min(pop + 1, maxPopulation);
    if (nextPop !== pop) {
      return {
        pop: nextPop,
        changed: true,
        lastPopulationGrowthMonth: monthIndex,
        reason: 'monthly_growth',
      };
    }
  }

  return { pop, changed: false, lastPopulationGrowthMonth };
}
