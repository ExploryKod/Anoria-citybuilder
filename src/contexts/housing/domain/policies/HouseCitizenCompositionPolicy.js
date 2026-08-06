/**
 * Housing BC — per-house citizen profile and skill counts (domain facts, no UI labels).
 */

import { getSkills, resolveCitizenStatusFromLevel } from '../../../../shared/population/CitizenStatusCatalog.js';
import { HOUSE_CITIZEN_CAP } from './HouseCapacityPolicy.js';
import { getCitizenSkillsForHouse } from './GroupLevel2SkillPolicy.js';

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * @param {string} type
 * @returns {boolean}
 */
function isPalaceHouseType(type) {
  const t = type || '';
  return t.includes('2Story') || t.includes('2-Story');
}

/**
 * @param {string} type
 * @param {number} pop
 * @returns {number}
 */
function elitePopFromHouse(type, pop) {
  const p = clampPop(pop);
  if (p <= 0 || !isPalaceHouseType(type)) return 0;
  return Math.max(0, p - HOUSE_CITIZEN_CAP);
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

  const eliteCount = elitePopFromHouse(buildingType, safePop);
  const workerCount = Math.max(0, safePop - eliteCount);
  /** @type {Array<{ statusKey: string, count: number }>} */
  const profiles = [];

  if (workerCount > 0) profiles.push({ statusKey: 'worker', count: workerCount });
  if (eliteCount > 0) profiles.push({ statusKey: 'elite', count: eliteCount });

  return profiles;
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
  const eliteEntry = profiles.find((profile) => profile.statusKey === 'elite');

  if (hunterEntry?.count > 0) {
    counts['subsistence-forager'] = hunterEntry.count;
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

  if (eliteEntry?.count > 0) {
    for (const skillKey of Object.keys(getSkills('elite'))) {
      counts[skillKey] = (counts[skillKey] ?? 0) + eliteEntry.count;
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
