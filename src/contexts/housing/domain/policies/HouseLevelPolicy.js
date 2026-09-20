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
 * — see `EvolveHouseBuilding` — untouched by this module.
 */

import { maxPopulationForLevel } from './HouseCapacityPolicy.js';
import { describeTierRequirements, meetsTierRequirements } from './HouseTierRequirementPolicy.js';
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';

export const HOUSE_LEVEL_AUTARKY = 1;
export const HOUSE_LEVEL_SPECIALIZED = 2;
export const HOUSE_LEVEL_ESTABLISHED = 3;
export const HOUSE_LEVEL_AFFLUENT = 4;

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
 * @param {Record<string, number>} [params.servedFlags] This house's
 *   service-coverage state (Supply's `servedFlags`, e.g. `{ faith: 7 }`) —
 *   only read when a tier declares a `serviceCoverage` requirement.
 * @param {{ month?: number, totalUnfed?: number, categoriesTaken?: string[] }} [params.lastConsumption]
 *   This house's latest food-consumption record (Supply's `lastConsumption`)
 *   — only read when a tier declares a `demandMet` or `goodsVariety` requirement.
 * @param {number} [params.periodKey] Current month index, compared against
 *   `servedFlags`/`lastConsumption` entries — only read for the same reason.
 * @returns {{
 *   targetLevel: number,
 *   targetPop: number,
 *   previousLevel: number,
 *   previousPop: number,
 *   changed: boolean,
 *   reason?: string,
 * }}
 */
export function resolveHouseLevel({ level, pop, roadCount, residentialGroup, servedFlags, lastConsumption, periodKey }) {
  const previousLevel = normalizeLevel(level);
  const previousPop = clampPop(pop);
  const tiers = residentialGroup ? SOCIAL_CATEGORY[residentialGroup]?.tiers : null;

  let targetLevel = previousLevel;
  let targetPop = previousPop;
  let reason;
  /** Why a demotion happened: the requirements of the tier that no longer hold. */
  let unmetRequirements;

  if (tiers) {
    const context = { pop: previousPop, roadCount: roadCount ?? 0, servedFlags, lastConsumption, periodKey };
    const nextTier = tiers[previousLevel + 1];

    if (nextTier && meetsTierRequirements(nextTier.requirements, context)) {
      targetLevel = previousLevel + 1;
      reason = `level${previousLevel}_to_level${targetLevel}`;
    } else {
      const currentTier = tiers[previousLevel];
      if (previousLevel > HOUSE_LEVEL_AUTARKY && currentTier && !meetsTierRequirements(currentTier.requirements, context)) {
        targetLevel = previousLevel - 1;
        targetPop = Math.min(previousPop, maxPopulationForLevel(targetLevel, residentialGroup));
        reason = `level${previousLevel}_to_level${targetLevel}_requirements_lost`;
        unmetRequirements = describeTierRequirements(currentTier.requirements, context)
          .filter((item) => !item.met)
          .map(({ kind, category, min, current, target }) => ({ kind, category, min, current, target }));
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
    unmetRequirements,
  };
}

/**
 * The `serviceCoverage` requirements relevant to a house RIGHT NOW: the
 * NEXT tier's, while the house hasn't maxed out (what's still blocking its
 * growth — e.g. a tier-1 house shows only Chapel's `faith`), or its own
 * final tier's once maxed (what's still sustaining it). Tier count is read
 * from the catalog, never hardcoded, so a 6th tier added later needs no
 * change here.
 *
 * Used by the house info panel's Services tab to show "reached or not" for
 * Chapel/Doctor/etc. the same way it already shows road/market reach — see
 * contexts/housing/docs/service-coverage.md.
 *
 * @param {{ level: number, residentialGroup: string | null }} params
 * @returns {ReadonlyArray<{ kind: 'serviceCoverage', category: string }>}
 */
export function relevantServiceCoverageRequirements({ level, residentialGroup }) {
  const tiers = residentialGroup ? SOCIAL_CATEGORY[residentialGroup]?.tiers : null;
  if (!tiers) return [];

  const maxTier = Math.max(...Object.keys(tiers).map(Number));
  const currentLevel = normalizeLevel(level);
  const targetTierNum = currentLevel < maxTier ? currentLevel + 1 : currentLevel;
  const targetTier = tiers[targetTierNum];
  if (!targetTier) return [];

  return targetTier.requirements.filter((requirement) => requirement.kind === 'serviceCoverage');
}

/**
 * Convenience wrapper: `relevantServiceCoverageRequirements` + their live
 * met/unmet status against this house's own `servedFlags`/`periodKey` — see
 * HouseTierRequirementPolicy.describeTierRequirements for the shape
 * (`{ category, current, target, met }` per entry, `category` riding along
 * from the original requirement).
 *
 * @param {{ level: number, residentialGroup: string | null, servedFlags?: Record<string, number>, periodKey?: number }} params
 * @returns {ReadonlyArray<{ kind: 'serviceCoverage', category: string, current: number, target: number, met: boolean }>}
 */
export function describeRelevantServiceCoverage({ level, residentialGroup, servedFlags, periodKey }) {
  const requirements = relevantServiceCoverageRequirements({ level, residentialGroup });
  return describeTierRequirements(requirements, { servedFlags, periodKey });
}
