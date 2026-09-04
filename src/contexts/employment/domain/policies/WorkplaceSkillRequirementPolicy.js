/**
 * Employment BC — which citizen skill is required to staff each workplace.
 *
 * Derived, not hand-authored: reads each building's own
 * `employment.requiredSkill` fact (buildingCatalog — see buildingEconomy.js).
 * One edit point for the fact instead of a hand-kept-in-sync copy.
 *
 * No skill -> social-group inverse lives here: a skill isn't assumed to
 * belong to exactly one group (shared/population/socialCategoryCatalog.js
 * lets any group declare any skill at any level), so "does this house's
 * group provide this skill" is answered per-house by Housing's
 * GroupSkillPolicy.getCitizenSkillsForHouse, not by inverting a skill list
 * here.
 */
import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';

/** @type {Readonly<Record<string, string>>} */
export const WORKPLACE_REQUIRED_SKILL = Object.freeze(
  Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.employment?.requiredSkill)
      .map(([id, def]) => [id, def.employment.requiredSkill])
  )
);

/**
 * @param {string} buildingType
 * @returns {string | null}
 */
export function getRequiredSkillForBuilding(buildingType) {
  return WORKPLACE_REQUIRED_SKILL[buildingType] ?? null;
}

/** @returns {ReadonlyArray<string>} */
export function allWorkplaceEmploymentSkills() {
  return Object.freeze([...new Set(Object.values(WORKPLACE_REQUIRED_SKILL))]);
}
