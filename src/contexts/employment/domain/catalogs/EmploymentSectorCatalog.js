/** Employment sector catalog — language shared with work-section UI. */

import { ROAD_RUNTIME_MARKER, primaryRoadType } from '../../../../shared/building-catalog/roadQueries.js';
import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';

export const EMPLOYMENT_MAX_SECTORS = 6;

/** @type {Readonly<Record<number, string>>} */
export const EMPLOYMENT_SECTOR_NAMES = Object.freeze({
  1: 'Production Alimentaire',
  2: 'Commerces',
  3: 'Industries',
  4: 'Stockage',
  5: 'Infrastructure',
  6: 'Services Publics',
});

/** @type {Readonly<Record<number, number>>} */
export const DEFAULT_SECTOR_PRIORITIES = Object.freeze({
  1: 6,
  2: 5,
  3: 4,
  4: 3,
  5: 1,
  6: 2,
});

/**
 * Derived from `buildingCatalog` (single source of truth for the static
 * `sector` fact per building type). The road runtime marker is aliased to the
 * road tool's facts: every placed road (whichever variant) gets its runtime
 * type marker set for connectivity (see roadQueries.js), so that's the key
 * sector lookups actually use — the marker itself is not a real building id.
 * @type {Readonly<Record<string, number>>}
 */
export const BUILDING_SECTOR_MAP = Object.freeze({
  ...Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.employment)
      .map(([id, def]) => [id, def.employment.sector])
  ),
  [ROAD_RUNTIME_MARKER]: buildingCatalog[primaryRoadType()].employment.sector,
});

/**
 * Derived from `buildingCatalog` for every type with a static worker need.
 * @type {Readonly<Record<string, { worker_need: number }>>}
 */
export const BUILDING_EMPLOYEE_NEEDS = Object.freeze({
  ...Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.employment?.workerNeed !== undefined)
      .map(([id, def]) => [id, { worker_need: def.employment.workerNeed }])
  ),
  // Same runtime-marker alias as BUILDING_SECTOR_MAP above.
  [ROAD_RUNTIME_MARKER]: {
    worker_need: buildingCatalog[primaryRoadType()].employment.workerNeed,
  },
});

/**
 * @param {string} buildingType
 * @returns {number}
 */
export function getBuildingEmploymentSector(buildingType) {
  if (!buildingType) return 0;
  if (BUILDING_SECTOR_MAP[buildingType]) {
    return BUILDING_SECTOR_MAP[buildingType];
  }
  const type = buildingType.toLowerCase();
  if (type.includes('house')) {
    return 0;
  }
  return 0;
}

/**
 * @param {string} sector
 * @returns {string}
 */
export function getEmploymentSectorName(sector) {
  if (!sector || sector === 0) return 'Résidentiel';
  return EMPLOYMENT_SECTOR_NAMES[sector] || `Secteur ${sector}`;
}
