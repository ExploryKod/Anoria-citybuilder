/**
 * Housing BC — skills granted to residents by house level and social group.
 *
 * Swappable gameplay tuning for early profession skills. Employment and
 * presentation consume this via housing application queries / composition.
 */

/** @type {Readonly<Record<string, string>>} */
export const GROUP_LEVEL2_SKILL = Object.freeze({
  'artisans': 'fermier',
  merchants: 'vente-alimentaire',
  scholars: 'stockage-alimentaire',
});

/**
 * @param {string} residentialGroup
 * @returns {string | null}
 */
export function resolveGroupLevel2Skill(residentialGroup) {
  return GROUP_LEVEL2_SKILL[residentialGroup] ?? null;
}

/**
 * @param {{ level: 1 | 2, residentialGroup: string | null }} params
 * @returns {ReadonlyArray<string>}
 */
export function getCitizenSkillsForHouse({ level, residentialGroup }) {
  if (level === 1) return residentialGroup ? ['subsistence-forager'] : [];
  if (level !== 2 || !residentialGroup) return [];

  const level2Skill = resolveGroupLevel2Skill(residentialGroup);
  return level2Skill
    ? ['subsistence-forager', level2Skill]
    : ['subsistence-forager'];
}

/**
 * @param {{ level: 1 | 2, residentialGroup: string | null }} house
 * @param {string} skillKey
 * @returns {boolean}
 */
export function houseCitizenHasSkill(house, skillKey) {
  return getCitizenSkillsForHouse(house).includes(skillKey);
}
