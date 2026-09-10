/**
 * Presentation — maps Housing citizen composition to labeled display items.
 */

import {
  DEFAULT_RESIDENTIAL_GROUP,
  GROUP_CITIZEN_PRESENTATION,
  PROFILE_DISPLAY_ORDER,
  STATUS_PRESENTATION,
} from './CitizenStatusPresentation.js';
import { SKILL_CATALOG, getSkillDisplay } from '../../../../shared/population/skillCatalog.js';

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

  const meta = getSkillDisplay(skillKey);

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

  // Every skill the catalog actually grants this house (`composition.skills`,
  // domain-computed — see HouseCitizenCompositionPolicy.js), not a fixed
  // list: SKILL_CATALOG's key order only decides ORDERING for the ones it
  // knows about, then any other skill (present in the catalog, absent from
  // that curated order) is appended after — so nothing is silently dropped.
  const preferredSkillOrder = Object.keys(SKILL_CATALOG);
  const skillKeys = Object.keys(composition.skills);
  const orderedSkillKeys = [
    ...preferredSkillOrder.filter((skillKey) => skillKeys.includes(skillKey)),
    ...skillKeys.filter((skillKey) => !preferredSkillOrder.includes(skillKey)),
  ];
  const skills = orderedSkillKeys
    .map((skillKey) => toSkillDisplayItem(skillKey, composition.skills[skillKey] ?? 0))
    .filter(Boolean);

  return { profiles, skills };
}
