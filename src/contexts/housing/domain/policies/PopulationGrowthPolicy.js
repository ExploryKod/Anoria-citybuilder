import {
  isPalaceHouseType,
  isResidentialHouseType,
  maxPopulationForHouseType,
  maxPopulationForLevel,
} from './HouseCapacityPolicy.js';

/**
 * Compute next population for a residential house at a monthly tick.
 *
 * Blue/Red/Purple houses grow toward their current `level`'s cap regardless
 * of road access — level 1 is autarkic by design (no road), and level 2's
 * road requirement is gated/enforced by `HouseLevelPolicy` (which demotes
 * the level, and clamps population, when the road is lost). Palace keeps its
 * historical road-gated behavior untouched (frozen path). // TODO(elites)
 *
 * @param {object} params
 * @param {string} params.type
 * @param {1 | 2} [params.level=1] Ignored for Palace.
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
  level = 1,
  currentPop,
  roadCount,
  monthIndex,
  lastPopulationGrowthMonth = null,
}) {
  const pop = Number.isFinite(currentPop) ? Math.max(0, Math.floor(currentPop)) : 0;

  if (!isResidentialHouseType(type)) {
    return { pop, changed: false, reason: 'not_residential' };
  }

  if (isPalaceHouseType(type)) {
    const maxPopulation = maxPopulationForHouseType(type);
    const hasRoadAccess = (roadCount ?? 0) > 0;

    if (!hasRoadAccess) {
      if (pop > 0) {
        return { pop: 0, changed: true, reason: 'no_road_access' };
      }
      return { pop: 0, changed: false, reason: 'no_road_access' };
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

  const maxPopulation = maxPopulationForLevel(level === 2 ? 2 : 1);

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
