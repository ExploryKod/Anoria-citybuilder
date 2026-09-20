/**
 * Housing BC — per-house citizen profile and skill counts (domain facts, no UI labels).
 */

import { resolveCitizenStatusFromLevel } from '../../../../shared/population/CitizenStatusCatalog.js';
import { getCitizenSkillsForHouse } from './GroupSkillPolicy.js';

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * @param {{ level: 1 | 2, pop: number, buildingType: string }} params
 * @returns {ReadonlyArray<{ statusKey: string, count: number }>}
 */
function computeProfileCounts({ level, pop, buildingType }) {
  const safePop = clampPop(pop);

  if (level === 1) {
    return safePop > 0 ? [{ statusKey: 'hunter-gatherer', count: safePop }] : [];
  }

  return safePop > 0 ? [{ statusKey: 'worker', count: safePop }] : [];
}

/**
 * @param {ReadonlyArray<{ statusKey: string, count: number }>} profiles
 * @param {string | null | undefined} residentialGroup
 * @param {1 | 2} level
 * @returns {Record<string, number>}
 */
function computeSkillCounts(profiles, residentialGroup, level) {
  /** @type {Record<string, number>} */
  const counts = {};

  const workerEntry = profiles.find((profile) => profile.statusKey === 'worker');
  const hunterEntry = profiles.find((profile) => profile.statusKey === 'hunter-gatherer');

  if (hunterEntry?.count > 0) {
    // Route through the catalog instead of hardcoding 'subsistence-forager':
    // tier 1 also grants 'spiritual' (see socialCategoryCatalog.js) — falls
    // back to the bare forager skill only when the group itself is unknown.
    const tier1Skills = residentialGroup
      ? getCitizenSkillsForHouse({ level: 1, residentialGroup })
      : ['subsistence-forager'];
    for (const skillKey of tier1Skills) {
      counts[skillKey] = (counts[skillKey] ?? 0) + hunterEntry.count;
    }
  }

  if (workerEntry?.count > 0 && residentialGroup) {
    for (const skillKey of getCitizenSkillsForHouse({ level, residentialGroup })) {
      if (skillKey === 'subsistence-forager') {
        counts[skillKey] = (counts[skillKey] ?? 0) + workerEntry.count;
      } else {
        counts[skillKey] = workerEntry.count;
      }
    }
  }

  return counts;
}

/**
 * @param {{ level: 1 | 2, pop: number, buildingType: string, residentialGroup: string | null }} params
 * @returns {{
 *   profiles: ReadonlyArray<{ statusKey: string, count: number }>,
 *   skills: Record<string, number>,
 *   statusKey: string,
 * }}
 */
export function computeHouseCitizenComposition({ level, pop, buildingType, residentialGroup }) {
  const profiles = computeProfileCounts({ level, pop, buildingType });
  const skills = computeSkillCounts(profiles, residentialGroup, level);
  const statusKey = resolveCitizenStatusFromLevel(level);

  return { profiles, skills, statusKey };
}
