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

  if (workerEntry?.count > 0 && residentialGroup) {
    for (const skillKey of getCitizenSkillsForHouse({ level, residentialGroup })) {
      counts[skillKey] = workerEntry.count;
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
