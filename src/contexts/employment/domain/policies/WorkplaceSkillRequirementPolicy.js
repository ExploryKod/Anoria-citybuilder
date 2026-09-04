/**
 * Employment BC — which citizen skill is required to staff each workplace.
 *
 * Both maps below are derived, not hand-authored: `WORKPLACE_REQUIRED_SKILL`
 * reads each building's own `employment.requiredSkill` fact (buildingCatalog
 * — see buildingEconomy.js), and `SKILL_TO_RESIDENTIAL_GROUP` inverts the
 * category → skill fact in shared/population/socialCategoryCatalog.js. One
 * edit point for each fact instead of two hand-kept-in-sync copies.
 */
import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';

/** @type {Readonly<Record<string, string>>} */
export const WORKPLACE_REQUIRED_SKILL = Object.freeze(
  Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.employment?.requiredSkill)
      .map(([id, def]) => [id, def.employment.requiredSkill])
  )
);

/**
 * Inverse of `SOCIAL_CATEGORY`'s skill fact (skill → social group id).
 * @type {Readonly<Record<string, string>>}
 */
export const SKILL_TO_RESIDENTIAL_GROUP = Object.freeze(
  Object.fromEntries(
    Object.entries(SOCIAL_CATEGORY).map(([group, facts]) => [facts.skill, group])
  )
);

/**
 * @param {string} buildingType
 * @returns {string | null}
 */
export function getRequiredSkillForBuilding(buildingType) {
  return WORKPLACE_REQUIRED_SKILL[buildingType] ?? null;
}

/**
 * @param {string} skillKey
 * @returns {string | null}
 */
export function residentialGroupForSkill(skillKey) {
  return SKILL_TO_RESIDENTIAL_GROUP[skillKey] ?? null;
}

/** @returns {ReadonlyArray<string>} */
export function allWorkplaceEmploymentSkills() {
  return Object.freeze([...new Set(Object.values(WORKPLACE_REQUIRED_SKILL))]);
}
