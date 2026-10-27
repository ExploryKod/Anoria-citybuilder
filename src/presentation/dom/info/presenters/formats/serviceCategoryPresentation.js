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
 * A category this dictionary does not name shows as "…" with a one-time console warning
 * (see `unresolvedTerm`, CatalogVocabulary.js), never a label made up from its id: the
 * gameplay-facing catalogs (socialCategoryCatalog.js's `serviceCoverage` requirements,
 * buildingEconomy.js's `resourceRoles` categories) are the single source of truth for
 * which category exists at all, and a new one must be named here.
 */

import { UNRESOLVED_TERM, unresolvedTerm } from '../../../shell/CatalogVocabulary.js';

/** @type {Readonly<Record<string, { label: string, emoji: string }>>} */
export const SERVICE_CATEGORY_PRESENTATION = Object.freeze({
  water: Object.freeze({ label: 'Eau', emoji: '💧' }),
  energy: Object.freeze({ label: 'Énergie', emoji: '⚡' }),
  fire: Object.freeze({ label: 'Lutte contre le feu', emoji: '🚒' }),
  police: Object.freeze({ label: 'Sécurité', emoji: '🚓' }),
  primarySchool: Object.freeze({ label: 'École primaire', emoji: '✏️' }),
  school: Object.freeze({ label: 'Collège-Lycée', emoji: '🏫' }),
  library: Object.freeze({ label: 'Savoir', emoji: '📖' }),
  doctor: Object.freeze({ label: 'Soins médicaux', emoji: '⚕️' }),
  hospital: Object.freeze({ label: 'Soins hospitaliers', emoji: '🏥' }),
  theatre: Object.freeze({ label: 'Spectacles', emoji: '🎭' }),
  cinema: Object.freeze({ label: 'Cinéma', emoji: '🎬' }),
  pub: Object.freeze({ label: 'Café-restaurant', emoji: '🍽️' }),
});

/**
 * @param {string} category
 * @returns {{ label: string, emoji: string }}
 */
export function getServiceCategoryDisplay(category) {
  const display = SERVICE_CATEGORY_PRESENTATION[category];
  if (display) return display;
  unresolvedTerm('service category display', category);
  return { label: UNRESOLVED_TERM, emoji: UNRESOLVED_TERM };
}
