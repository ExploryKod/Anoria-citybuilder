/**
 * Housing BC — skills granted to residents by house level and social group.
 *
 * One policy for every level: it never hardcodes a level number, it just
 * unions whatever shared/population/socialCategoryCatalog.js declares for
 * every level up to and including the house's own — adding a new level (or
 * changing what a group unlocks at an existing one) is a catalog edit here,
 * not a code change. Employment and presentation consume this via housing
 * application queries / composition.
 */
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';

/**
 * @param {{ level: number, residentialGroup: string | null }} params
 * @returns {ReadonlyArray<string>}
 */
export function getCitizenSkillsForHouse({ level, residentialGroup }) {
  const facts = residentialGroup ? SOCIAL_CATEGORY[residentialGroup] : null;
  if (!facts) return [];

  const skills = new Set();
  for (const [tierLevel, tierSkills] of Object.entries(facts.skillsByLevel)) {
    if (Number(tierLevel) <= level) {
      tierSkills.forEach((skill) => skills.add(skill));
    }
  }
  return Object.freeze([...skills]);
}

/**
 * @param {{ level: number, residentialGroup: string | null }} house
 * @param {string} skillKey
 * @returns {boolean}
 */
export function houseCitizenHasSkill(house, skillKey) {
  return getCitizenSkillsForHouse(house).includes(skillKey);
}
