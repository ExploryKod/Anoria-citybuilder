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

/**
 * @param {number} sector
 * @returns {string}
 */
export function getEmploymentSectorName(sector) {
  if (!sector || sector === 0) return 'Résidentiel';
  return EMPLOYMENT_SECTOR_NAMES[sector] || `Secteur ${sector}`;
}
