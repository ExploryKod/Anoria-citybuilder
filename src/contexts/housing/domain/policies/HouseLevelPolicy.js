/**
 * House level (tier) policy — Blue/Red/Purple houses only.
 *
 * Replaces the old color-ladder (`HouseEvolutionPolicy.resolveHouseEvolution`)
 * for these three types: the house color (`type`) is a permanent social-group
 * marker set once at placement and never changes again. Only `level` evolves
 * per instance, one tier at a time, driven entirely by each social
 * category's declarative `tiers` (see shared/population/socialCategoryCatalog.js):
 * advancing to tier N+1 requires tier N+1's own `requirements` to hold;
 * losing tier N's `requirements` (e.g. road access) demotes back to N-1.
 * No tier count or requirement kind is hardcoded here — add a tier, or
 * change what unlocks one, in the catalog only.
 *
 * Palace (`House-2Story`) keeps its own frozen path in `HouseEvolutionPolicy`
 * — see `EvolveHouseBuilding` — untouched by this module. // TODO(elites)
 */

import { maxPopulationForLevel } from './HouseCapacityPolicy.js';
import { meetsTierRequirements, describeTierRequirements } from './HouseTierRequirementPolicy.js';
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';

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
 * @returns {number}
 */
function normalizeLevel(level) {
  return Number.isFinite(level) && level >= HOUSE_LEVEL_AUTARKY ? Math.floor(level) : HOUSE_LEVEL_AUTARKY;
}

/**
 * Resolve the level (and population clamp) for a Blue/Red/Purple house.
 *
 * @param {object} params
 * @param {number} params.level
 * @param {number} params.pop
 * @param {number} params.roadCount
 * @param {string | null} params.residentialGroup
 * @returns {{
 *   targetLevel: number,
 *   targetPop: number,
 *   previousLevel: number,
 *   previousPop: number,
 *   changed: boolean,
 *   reason?: string,
 * }}
 */
export function resolveHouseLevel({ level, pop, roadCount, residentialGroup }) {
  const previousLevel = normalizeLevel(level);
  const previousPop = clampPop(pop);
  const tiers = residentialGroup ? SOCIAL_CATEGORY[residentialGroup]?.tiers : null;

  let targetLevel = previousLevel;
  let targetPop = previousPop;
  let reason;

  if (tiers) {
    const context = { pop: previousPop, roadCount: roadCount ?? 0 };
    const nextTier = tiers[previousLevel + 1];

    if (nextTier && meetsTierRequirements(nextTier.requirements, context)) {
      targetLevel = previousLevel + 1;
      reason = `level${previousLevel}_to_level${targetLevel}`;
    } else {
      const currentTier = tiers[previousLevel];
      if (previousLevel > HOUSE_LEVEL_AUTARKY && currentTier && !meetsTierRequirements(currentTier.requirements, context)) {
        targetLevel = previousLevel - 1;
        targetPop = Math.min(previousPop, maxPopulationForLevel(targetLevel));
        reason = `level${previousLevel}_to_level${targetLevel}_requirements_lost`;
      }
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

/**
 * Requirements for a house's NEXT tier — info-panel read model, no
 * persistence. Same catalog lookup as `resolveHouseLevel` (tiers[level + 1]),
 * described rather than just met/not-met so a UI can render progress
 * ("3/1 ✓", "0/1"). Empty when the house is already at its category's top
 * tier (no `tiers[level + 1]` declared).
 *
 * @param {object} params
 * @param {number} params.level
 * @param {number} params.pop
 * @param {number} params.roadCount
 * @param {string | null} params.residentialGroup
 * @returns {{
 *   hasNextTier: boolean,
 *   nextLevel: number | null,
 *   items: ReadonlyArray<{ kind: string, current: number, target: number, met: boolean }>,
 * }}
 */
export function describeNextTierRequirements({ level, pop, roadCount, residentialGroup }) {
  const currentLevel = normalizeLevel(level);
  const tiers = residentialGroup ? SOCIAL_CATEGORY[residentialGroup]?.tiers : null;
  const nextTier = tiers?.[currentLevel + 1];

  if (!nextTier) {
    return { hasNextTier: false, nextLevel: null, items: [] };
  }

  const context = { pop: clampPop(pop), roadCount: roadCount ?? 0 };
  return {
    hasNextTier: true,
    nextLevel: currentLevel + 1,
    items: describeTierRequirements(nextTier.requirements, context),
  };
}
