/**
 * House level (tier) policy — Blue/Red/Purple houses only.
 *
 * The house color (`type`) is a permanent social-group
 * marker set once at placement and never changes again. Only `level` evolves
 * per instance, one tier at a time, driven entirely by each social
 * category's declarative `tiers` (see shared/population/socialCategoryCatalog.js):
 * advancing to tier N+1 requires tier N+1's own `requirements` to hold;
 * losing tier N's `requirements` (e.g. road access) demotes back to N-1.
 * No tier count or requirement kind is hardcoded here — add a tier, or
 * change what unlocks one, in the catalog only.
 *
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
 * @param {{ month?: number, totalUnfed?: number }} [params.lastFaithConsumption]
 *   This house's latest faith-consumption record (Supply's `lastFaithConsumption`,
 *   written by ConsumeResource for Chapel's FAITH_CONSUMER, 2026-10-10) — only read
 *   when a tier declares a `serviceDemandMet` requirement for `category: 'faith'`.
 * @param {number} [params.periodKey] Current month index, compared against
 *   `servedFlags`/`lastConsumption`/`lastFaithConsumption` entries — only read for the same reason.
 * @returns {{
 *   targetLevel: number,
 *   targetPop: number,
 *   previousLevel: number,
 *   previousPop: number,
 *   changed: boolean,
 *   reason?: string,
 * }}
 */
export function resolveHouseLevel({ level, pop, roadCount, residentialGroup, servedFlags, lastConsumption, lastFaithConsumption, periodKey }) {
  const previousLevel = normalizeLevel(level);
  const previousPop = clampPop(pop);
  const tiers = residentialGroup ? SOCIAL_CATEGORY[residentialGroup]?.tiers : null;

  let targetLevel = previousLevel;
  let targetPop = previousPop;
  let reason;
  /** Why a demotion happened: the requirements of the tier that no longer hold. */
  let unmetRequirements;

  if (tiers) {
    const context = { pop: previousPop, roadCount: roadCount ?? 0, servedFlags, lastConsumption, lastFaithConsumption, periodKey };
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
 * EVERY requirement relevant to a house RIGHT NOW: the NEXT tier's, while
 * the house hasn't maxed out (what's still blocking its growth — e.g. a
 * tier-1 house shows only Chapel's `faith`), or its own final tier's once
 * maxed (what's still sustaining it). Tier count is read from the catalog,
 * never hardcoded, so a 6th tier added later needs no change here.
 *
 * Used by the house info panel's Services tab, under "Besoins pour
 * l'évolution" (2026-10-10): every requirement kind the tier ladder
 * declares — road, population, demandMet (food), goodsVariety,
 * serviceCoverage/serviceDemandMet (Doctor, Chapel's faith, ...) — each
 * read as a plain met/unmet fact there, never the raw figure (that figure
 * already lives on the Ressources tab, under its own need or the Services
 * group). `roadAccess` is excluded: the panel already shows Route as its
 * own, building-type-agnostic chip (works for a farm too, which has no
 * tier ladder at all) — repeating the exact same fact here would be the
 * redundancy this split is meant to avoid.
 *
 * @param {{ level: number, residentialGroup: string | null }} params
 * @returns {ReadonlyArray<{ kind: string, category?: string }>}
 */
export function relevantServiceCoverageRequirements({ level, residentialGroup }) {
  const tiers = residentialGroup ? SOCIAL_CATEGORY[residentialGroup]?.tiers : null;
  if (!tiers) return [];

  const maxTier = Math.max(...Object.keys(tiers).map(Number));
  const currentLevel = normalizeLevel(level);
  const targetTierNum = currentLevel < maxTier ? currentLevel + 1 : currentLevel;
  const targetTier = tiers[targetTierNum];
  if (!targetTier) return [];

  return targetTier.requirements.filter((requirement) => requirement.kind !== 'roadAccess');
}

/**
 * Convenience wrapper: `relevantServiceCoverageRequirements` + their live
 * met/unmet status against this house's own `servedFlags`/`periodKey` — see
 * HouseTierRequirementPolicy.describeTierRequirements for the shape
 * (`{ category, current, target, met }` per entry, `category` riding along
 * from the original requirement).
 *
 * @param {{ level: number, residentialGroup: string | null, pop?: number, servedFlags?: Record<string, number>, lastConsumption?: object, lastFaithConsumption?: object, periodKey?: number }} params
 * @returns {ReadonlyArray<{ kind: string, category?: string, current: number, target: number, met: boolean }>}
 */
export function describeRelevantServiceCoverage({ level, residentialGroup, pop, servedFlags, lastConsumption, lastFaithConsumption, periodKey }) {
  const requirements = relevantServiceCoverageRequirements({ level, residentialGroup });
  return describeTierRequirements(requirements, { pop, servedFlags, lastConsumption, lastFaithConsumption, periodKey });
}
