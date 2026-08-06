/** Employment sector catalog — language shared with work-section UI. */

import { getBarnMaxWorkers } from '../../../supply/domain/catalogs/BarnCommerceCatalog.js';
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
 * `sector` fact per building type).
 * @type {Readonly<Record<string, number>>}
 */
export const BUILDING_SECTOR_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.employment)
      .map(([id, def]) => [id, def.employment.sector])
  )
);

/**
 * Derived from `buildingCatalog` for every type with static worker/elite
 * needs. Barn-001 is the one exception: its capacity is computed from
 * storage rules owned by the supply bounded context (not a fixed fact),
 * so it's merged in separately instead of being baked into the catalog.
 * @type {Readonly<Record<string, { worker_need: number, elite_need: number }>>}
 */
export const BUILDING_EMPLOYEE_NEEDS = Object.freeze({
  ...Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.employment?.workerNeed !== undefined)
      .map(([id, def]) => [
        id,
        { worker_need: def.employment.workerNeed, elite_need: def.employment.eliteNeed ?? 0 },
      ])
  ),
  'Barn-001': { worker_need: getBarnMaxWorkers(), elite_need: 0 },
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
