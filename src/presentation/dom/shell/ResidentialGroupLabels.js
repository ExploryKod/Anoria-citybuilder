/**
 * Display labels for the permanent social groups (house color) and their
 * per-instance level (1 = autarky, 2 = specialized group profession).
 * Derived from `residentialGroup` in the shared building catalog — the
 * single source of truth for this static fact.
 */

import { buildingCatalog } from '../../../shared/building-catalog/buildingCatalog.js';

const RESIDENTIAL_GROUP_BY_TYPE = Object.fromEntries(
    Object.entries(buildingCatalog)
        .filter(([, def]) => def.residentialGroup)
        .map(([id, def]) => [id, def.residentialGroup])
);

const GROUP_LABELS = {
    'artisans-ouvriers': 'Artisans-ouvriers',
    commercants: 'Commerçants',
    savants: 'Savants',
};

const GROUP_TITLES = {
    'artisans-ouvriers': 'Groupe des artisans',
    commercants: 'Groupe des commerçants',
    savants: 'Groupe des savants',
};

const LEVEL_1_LABEL = 'Chasseurs-cueilleurs';

/**
 * @param {string} buildingType
 * @returns {string | null} The group id (e.g. `'commercants'`), or null if
 *   `buildingType` isn't a grouped residential house.
 */
export function residentialGroupForType(buildingType) {
    if (!buildingType) return null;
    if (RESIDENTIAL_GROUP_BY_TYPE[buildingType]) return RESIDENTIAL_GROUP_BY_TYPE[buildingType];
    const matchKey = Object.keys(RESIDENTIAL_GROUP_BY_TYPE).find((key) =>
        buildingType.startsWith(key)
    );
    return matchKey ? RESIDENTIAL_GROUP_BY_TYPE[matchKey] : null;
}

/** @param {string} group @returns {string} */
export function getResidentialGroupTitle(group) {
    return GROUP_TITLES[group] || `Groupe des ${getResidentialGroupLabel(group).toLowerCase()}`;
}

/** @param {string} group @returns {string} */
export function getResidentialGroupLabel(group) {
    return GROUP_LABELS[group] || group;
}

/**
 * @param {string} buildingType
 * @param {1 | 2} [level]
 * @returns {string} e.g. "Commerçants (Chasseurs-cueilleurs)" for level 1,
 *   "Commerçants" for level 2. Empty string if not a grouped house.
 */
export function getResidentialGroupAndLevelLabel(buildingType, level) {
    const group = residentialGroupForType(buildingType);
    if (!group) return '';
    const groupLabel = getResidentialGroupLabel(group);
    return level === 1 ? `${groupLabel} (${LEVEL_1_LABEL})` : groupLabel;
}
