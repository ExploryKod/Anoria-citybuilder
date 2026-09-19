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

/**
 * Minimum skill level a citizen needs to staff this building — 1 when the
 * catalog doesn't say otherwise (most buildings only ever need level 1; a
 * building can opt into a higher level via `employment.requiredSkillLevel`,
 * e.g. Hospital's `medical` level 2 vs Doctor's level 1 — see
 * buildingEconomy.js).
 *
 * @param {string} buildingType
 * @returns {number}
 */
export function getRequiredSkillLevelForBuilding(buildingType) {
  return buildingCatalog[buildingType]?.employment?.requiredSkillLevel ?? 1;
}

/** @returns {ReadonlyArray<string>} */
export function allWorkplaceEmploymentSkills() {
  return Object.freeze([...new Set(Object.values(WORKPLACE_REQUIRED_SKILL))]);
}
