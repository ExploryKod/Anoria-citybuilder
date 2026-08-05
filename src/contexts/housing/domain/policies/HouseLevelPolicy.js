/**
 * House level policy — Blue/Red/Purple houses only.
 *
 * Replaces the old color-ladder (`HouseEvolutionPolicy.resolveHouseEvolution`)
 * for these three types: the house color (`type`) is a permanent social-group
 * marker set once at placement and never changes again. Only `level` (1 or 2)
 * evolves per instance:
 *   - Level 1 (autarky / hunter-gatherer): no road required, capped low.
 *   - Level 2 (group profession): road required, capped higher.
 *
 * Palace (`House-2Story`) keeps its own frozen path in `HouseEvolutionPolicy`
 * — see `EvolveHouseBuilding` — untouched by this module. // TODO(elites)
 */

import { maxPopulationForLevel } from './HouseCapacityPolicy.js';

export const HOUSE_LEVEL_AUTARKY = 1;
export const HOUSE_LEVEL_SPECIALIZED = 2;

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * @param {number} level
 * @returns {1 | 2}
 */
function normalizeLevel(level) {
  return level === HOUSE_LEVEL_SPECIALIZED ? HOUSE_LEVEL_SPECIALIZED : HOUSE_LEVEL_AUTARKY;
}

/**
 * Resolve the level (and population clamp) for a Blue/Red/Purple house.
 *
 * @param {object} params
 * @param {1 | 2} params.level
 * @param {number} params.pop
 * @param {number} params.roadCount
 * @returns {{
 *   targetLevel: 1 | 2,
 *   targetPop: number,
 *   previousLevel: 1 | 2,
 *   previousPop: number,
 *   changed: boolean,
 *   reason?: string,
 * }}
 */
export function resolveHouseLevel({ level, pop, roadCount }) {
  const previousLevel = normalizeLevel(level);
  const previousPop = clampPop(pop);
  const hasRoadAccess = (roadCount ?? 0) > 0;

  let targetLevel = previousLevel;
  let targetPop = previousPop;
  let reason;

  if (previousLevel === HOUSE_LEVEL_AUTARKY) {
    if (hasRoadAccess && previousPop > 0) {
      targetLevel = HOUSE_LEVEL_SPECIALIZED;
      reason = 'level1_to_level2';
    }
  } else if (previousLevel === HOUSE_LEVEL_SPECIALIZED) {
    if (!hasRoadAccess) {
      targetLevel = HOUSE_LEVEL_AUTARKY;
      targetPop = Math.min(previousPop, maxPopulationForLevel(HOUSE_LEVEL_AUTARKY));
      reason = 'level2_to_level1_no_road';
    }
  }

  const changed = targetLevel !== previousLevel || targetPop !== previousPop;

  return {
    targetLevel,
    targetPop,
    previousLevel,
    previousPop,
    changed,
    reason,
  };
}
