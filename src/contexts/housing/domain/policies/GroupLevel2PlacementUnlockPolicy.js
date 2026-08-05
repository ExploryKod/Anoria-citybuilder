/**
 * Housing BC — tool-panel building unlocks when a social group reaches level 2.
 */

import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { GROUP_LEVEL2_SKILL } from './GroupLevel2SkillPolicy.js';

/**
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const GROUP_LEVEL2_UNLOCKED_BUILDINGS = Object.freeze({
  'artisans-ouvriers': Object.freeze(['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage']),
  commercants: Object.freeze(['Market-Stall-Red']),
  savants: Object.freeze(['Windmill-001']),
});

/**
 * @param {string} buildingType
 * @returns {string | null}
 */
export function residentialGroupForHouseType(buildingType) {
  if (!buildingType) return null;
  const direct = buildingCatalog[buildingType]?.residentialGroup;
  if (direct) return direct;
  const matchKey = Object.keys(buildingCatalog).find((key) => buildingType.startsWith(key));
  return matchKey ? buildingCatalog[matchKey]?.residentialGroup ?? null : null;
}

/**
 * @param {ReadonlyArray<{ type?: string, level?: number }>} houses
 * @returns {Readonly<Record<string, boolean>>}
 */
export function evaluateGroupLevel2UnlockStatus(houses) {
  /** @type {Record<string, boolean>} */
  const status = {};
  for (const group of Object.keys(GROUP_LEVEL2_UNLOCKED_BUILDINGS)) {
    status[group] = houses.some(
      (house) =>
        residentialGroupForHouseType(house.type) === group
        && house.level === 2,
    );
  }
  return Object.freeze(status);
}

/**
 * @param {string} buildingId
 * @returns {string | null}
 */
export function unlockGroupForBuilding(buildingId) {
  for (const [group, buildingIds] of Object.entries(GROUP_LEVEL2_UNLOCKED_BUILDINGS)) {
    if (buildingIds.includes(buildingId)) return group;
  }
  return null;
}

/** @returns {ReadonlyArray<string>} */
export function allUnlockableSocialGroups() {
  return Object.freeze(Object.keys(GROUP_LEVEL2_SKILL));
}
