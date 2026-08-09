/**
 * Employment BC — which citizen skill is required to staff each workplace.
 *
 * Kept separate from Housing placement unlocks so recruitment rules can evolve
 * independently (e.g. barn vs windmill, future artisan tier).
 */

/** @type {Readonly<Record<string, string>>} */
export const WORKPLACE_REQUIRED_SKILL = Object.freeze({
  'Farm-Wheat': 'fermier',
  'Farm-Carrot': 'fermier',
  'Farm-Cabbage': 'fermier',
  'Market-Stall-Red': 'vente-alimentaire',
  'Windmill-001': 'stockage-alimentaire',
});

/**
 * Inverse map for allocation passes (skill → social group id).
 * Must stay aligned with Housing `GROUP_LEVEL2_SKILL`.
 * @type {Readonly<Record<string, string>>}
 */
export const SKILL_TO_RESIDENTIAL_GROUP = Object.freeze({
  fermier: 'artisans',
  'vente-alimentaire': 'merchants',
  'stockage-alimentaire': 'scholars',
});

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
