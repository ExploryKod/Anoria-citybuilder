/**
 * Presentation — maps Housing citizen composition to labeled display items.
 */

import {
  DEFAULT_RESIDENTIAL_GROUP,
  GROUP_CITIZEN_PRESENTATION,
  PROFILE_DISPLAY_ORDER,
  SKILL_DISPLAY_ORDER,
  SKILL_PRESENTATION,
  STATUS_PRESENTATION,
} from './CitizenStatusPresentation.js';

/**
 * @param {string} statusKey
 * @param {number} count
 * @param {string | null | undefined} residentialGroup
 */
function toProfileDisplayItem(statusKey, count, residentialGroup) {
  if (count <= 0) return null;

  const meta = statusKey === 'worker'
    ? (GROUP_CITIZEN_PRESENTATION[residentialGroup ?? DEFAULT_RESIDENTIAL_GROUP]
      ?? GROUP_CITIZEN_PRESENTATION[DEFAULT_RESIDENTIAL_GROUP])
    : STATUS_PRESENTATION[statusKey];
  if (!meta) return null;

  const labelForm = count > 1 ? meta.plural : meta.singular;
  return {
    statusKey,
    label: meta.label.toLowerCase(),
    emoji: meta.emoji,
    count,
    ariaLabel: `${count} ${labelForm}`,
  };
}

/**
 * @param {string} skillKey
 * @param {number} count
 */
function toSkillDisplayItem(skillKey, count) {
  if (count <= 0) return null;

  const meta = SKILL_PRESENTATION[skillKey];
  if (!meta) return null;

  return {
    skillKey,
    label: meta.label.toLowerCase(),
    emoji: meta.emoji,
    count,
    ariaLabel: `${count} compétence${count > 1 ? 's' : ''} en ${meta.label.toLowerCase()}`,
  };
}

/**
 * @param {ReturnType<import('../../../../contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js').computeHouseCitizenComposition>} composition
 * @param {string | null | undefined} residentialGroup
 */
export function formatHousePopulationPresentation(composition, residentialGroup) {
  const countByStatus = Object.fromEntries(
    composition.profiles.map((profile) => [profile.statusKey, profile.count]),
  );

  const profiles = PROFILE_DISPLAY_ORDER
    .map((statusKey) => toProfileDisplayItem(statusKey, countByStatus[statusKey] ?? 0, residentialGroup))
    .filter(Boolean);

  const skills = SKILL_DISPLAY_ORDER
    .map((skillKey) => toSkillDisplayItem(skillKey, composition.skills[skillKey] ?? 0))
    .filter(Boolean);

  return { profiles, skills };
}
