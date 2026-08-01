/** Employment sector catalog — language shared with work-section UI. */

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

/** @type {Readonly<Record<string, number>>} */
export const BUILDING_SECTOR_MAP = Object.freeze({
  'Farm-Wheat': 1,
  'Farm-Carrot': 1,
  'Farm-Cabbage': 1,
  'Market-Stall': 2,
  'Winery-001': 3,
  'Windmill-001': 4,
  'Barn-001': 4,
  roads: 5,
});

/** @type {Readonly<Record<string, { worker_need: number, elite_need: number }>>} */
export const BUILDING_EMPLOYEE_NEEDS = Object.freeze({
  'Farm-Wheat': { worker_need: 3, elite_need: 0 },
  'Farm-Carrot': { worker_need: 3, elite_need: 0 },
  'Farm-Cabbage': { worker_need: 3, elite_need: 0 },
  'Windmill-001': { worker_need: 4, elite_need: 2 },
  'Market-Stall': { worker_need: 2, elite_need: 1 },
  'Winery-001': { worker_need: 18, elite_need: 0 },
  'Barn-001': { worker_need: 1, elite_need: 0 },
  roads: { worker_need: 0, elite_need: 0 },
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
