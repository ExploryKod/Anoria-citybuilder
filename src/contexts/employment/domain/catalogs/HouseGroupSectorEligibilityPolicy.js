/**
 * Social group -> eligible employment sectors.
 *
 * A house's `residentialGroup` (permanent fact from the shared building
 * catalog, keyed by color) determines which sectors its citizens may work
 * in. Sector 5 (Infrastructure/roads) is intentionally absent — it is open
 * to everyone, but `roads` needs 0 workers today so it never manifests as an
 * actual workplace (see `BuildingRolePolicy.isWorkplace`).
 */

import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';

export const SOCIAL_GROUP_ARTISANS_OUVRIERS = 'artisans-ouvriers';
export const SOCIAL_GROUP_COMMERCANTS = 'commercants';
export const SOCIAL_GROUP_SAVANTS = 'savants';

/** @type {Readonly<Record<string, ReadonlyArray<number>>>} */
export const GROUP_ELIGIBLE_SECTORS = Object.freeze({
  [SOCIAL_GROUP_ARTISANS_OUVRIERS]: Object.freeze([1, 3, 4]),
  [SOCIAL_GROUP_COMMERCANTS]: Object.freeze([2]),
  [SOCIAL_GROUP_SAVANTS]: Object.freeze([6]),
});

/**
 * Derived from `buildingCatalog` (single source of truth for the static
 * `residentialGroup` fact per house color).
 * @type {Readonly<Record<string, string>>}
 */
export const RESIDENTIAL_GROUP_BY_TYPE = Object.freeze(
  Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.residentialGroup)
      .map(([id, def]) => [id, def.residentialGroup])
  )
);

/** @returns {ReadonlyArray<string>} */
export function allSocialGroups() {
  return Object.keys(GROUP_ELIGIBLE_SECTORS);
}

/**
 * @param {string} type House `type` field (e.g. `House-Red`).
 * @returns {string | null}
 */
export function residentialGroupForType(type) {
  return RESIDENTIAL_GROUP_BY_TYPE[type] ?? null;
}

/**
 * @param {string} group
 * @returns {ReadonlyArray<number>}
 */
export function eligibleSectorsForGroup(group) {
  return GROUP_ELIGIBLE_SECTORS[group] ?? [];
}
