/**
 * Tool-panel unlock rule for the Blue (commerçants) and Purple (savants)
 * house groups: they stay disabled until the city has proven it can sustain
 * the Red (artisans-ouvriers) group at level 2 (specialized profession).
 */

import { HOUSE_TYPE_RED, normalizeResidentialType } from '../HouseTypeCatalog.js';

/** Adjustable, single source of truth — do not hardcode this number elsewhere. */
export const RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD = 2;

/**
 * @param {ReadonlyArray<{ type?: string, level?: number }>} houses
 * @returns {number}
 */
export function countRedHousesAtLevel2(houses) {
  return houses.filter(
    (house) => normalizeResidentialType(house.type) === HOUSE_TYPE_RED && house.level === 2
  ).length;
}

/**
 * @param {ReadonlyArray<{ type?: string, level?: number }>} houses
 * @returns {{ unlocked: boolean, redLevel2Count: number, threshold: number }}
 */
export function evaluateResidentialGroupUnlock(houses) {
  const redLevel2Count = countRedHousesAtLevel2(houses);
  return {
    unlocked: redLevel2Count >= RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD,
    redLevel2Count,
    threshold: RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD,
  };
}
