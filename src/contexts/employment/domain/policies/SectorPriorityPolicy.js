import {
  DEFAULT_SECTOR_PRIORITIES,
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
} from '../catalogs/EmploymentSectorCatalog.js';

/**
 * @param {number} sector
 * @param {Record<number|string, number>} userPriorities
 * @returns {number}
 */
export function resolveSectorPriorityValue(sector, userPriorities = {}) {
  if (!sector || sector === 0) return 99;

  if (userPriorities[sector] !== undefined) {
    return userPriorities[sector];
  }

  return DEFAULT_SECTOR_PRIORITIES[sector] ?? sector;
}

/**
 * Raw map from storage or full defaults when empty.
 * @param {Record<number|string, number>|null|undefined} userPriorities
 * @returns {Record<number, number>}
 */
export function getStoredOrDefaultPriorities(userPriorities) {
  if (userPriorities && Object.keys(userPriorities).length > 0) {
    return { ...userPriorities };
  }
  return { ...DEFAULT_SECTOR_PRIORITIES };
}

/**
 * Merge user overrides with defaults for every known sector (UI display).
 * @param {Record<number|string, number>|null|undefined} userPriorities
 * @returns {Record<number, number>}
 */
export function mergeAllSectorPriorities(userPriorities) {
  const merged = {};
  for (const sectorNum of Object.keys(EMPLOYMENT_SECTOR_NAMES)) {
    const secNum = parseInt(sectorNum, 10);
    merged[secNum] =
      userPriorities?.[secNum] !== undefined
        ? userPriorities[secNum]
        : (DEFAULT_SECTOR_PRIORITIES[secNum] || 1);
  }
  return merged;
}

/**
 * Caesar 3-style priority swap.
 * @param {number} sector
 * @param {number} newPriority
 * @param {Record<number|string, number>} userPriorities
 * @param {number} [maxSectors=EMPLOYMENT_MAX_SECTORS]
 * @returns {Record<number, number>}
 */
export function swapSectorPriority(
  sector,
  newPriority,
  userPriorities = {},
  maxSectors = EMPLOYMENT_MAX_SECTORS
) {
  const priorities = { ...userPriorities };
  const clampedPriority = Math.max(1, Math.min(maxSectors, newPriority));
  const currentPriority = resolveSectorPriorityValue(sector, priorities);

  if (currentPriority === clampedPriority) {
    return priorities;
  }

  let sectorWithNewPriority = null;
  for (const sectorNumStr of Object.keys(EMPLOYMENT_SECTOR_NAMES)) {
    const secNum = parseInt(sectorNumStr, 10);
    if (secNum === sector) continue;

    const currentSecPriority = resolveSectorPriorityValue(secNum, priorities);
    if (currentSecPriority === clampedPriority) {
      sectorWithNewPriority = secNum;
      break;
    }
  }

  priorities[sector] = clampedPriority;
  if (sectorWithNewPriority !== null) {
    priorities[sectorWithNewPriority] = currentPriority;
  }

  return priorities;
}
