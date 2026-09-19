/**
 * Single source of truth for a service category's display (label, emoji) —
 * same shape/role as shared/population/skillCatalog.js, one level up in
 * presentation since a service category (unlike a skill id) has no
 * gameplay meaning outside display: it's read by both the service
 * building's own info panel (serviceInfoFormat.js's "Service rendu" row)
 * and a house's Services tab chips (servicesInfoFormat.js's "reached or
 * not" indicators) — one dictionary instead of two independently-curated
 * copies.
 *
 * Cosmetic only: an uncurated category still displays (see
 * `getServiceCategoryDisplay`'s fallback) — the gameplay-facing catalogs
 * (socialCategoryCatalog.js's `serviceCoverage` requirements,
 * buildingEconomy.js's `resourceRoles` categories) are the single source
 * of truth for which category exists at all.
 */

/** @type {Readonly<Record<string, { label: string, emoji: string }>>} */
export const SERVICE_CATEGORY_PRESENTATION = Object.freeze({
  faith: Object.freeze({ label: 'Foi', emoji: '⛪' }),
  school: Object.freeze({ label: 'Éducation', emoji: '🏫' }),
  library: Object.freeze({ label: 'Savoir', emoji: '📖' }),
  doctor: Object.freeze({ label: 'Soins médicaux', emoji: '⚕️' }),
  hospital: Object.freeze({ label: 'Soins hospitaliers', emoji: '🏥' }),
  publicBath: Object.freeze({ label: 'Hygiène publique', emoji: '🛁' }),
  theatre: Object.freeze({ label: 'Spectacles', emoji: '🎭' }),
  cinema: Object.freeze({ label: 'Cinéma', emoji: '🎬' }),
  pub: Object.freeze({ label: 'Convivialité', emoji: '🍺' }),
});

/**
 * @param {string} category
 * @returns {string}
 */
function humanizeCategory(category) {
  return category
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * @param {string} category
 * @returns {{ label: string, emoji: string }}
 */
export function getServiceCategoryDisplay(category) {
  return SERVICE_CATEGORY_PRESENTATION[category] ?? { label: humanizeCategory(category), emoji: '🔧' };
}
