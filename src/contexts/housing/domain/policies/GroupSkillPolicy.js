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
import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';

/**
 * @param {string} buildingType
 * @returns {string | null}
 */
export function residentialGroupForHouseType(buildingType) {
  if (!buildingType) return null;
  const direct = buildingCatalog[buildingType]?.residentialGroup;
  if (direct) return direct;
  const matchKey = Object.keys(buildingCatalog).find((key) => buildingType.startsWith(key));
  return matchKey ? buildingCatalog[matchKey]?.residentialGroup ?? null : null;
}

/**
 * Every skill this house's citizens hold, at the level granted by the
 * highest tier ≤ the house's own level that mentions it (a skill regranted
 * at a later tier to raise its level doesn't need to repeat anything from
 * the earlier grant — see socialCategoryCatalog.js's `skills` doc).
 *
 * @param {{ level: number, residentialGroup: string | null }} params
 * @returns {Readonly<Record<string, number>>}
 */
export function getCitizenSkillLevelsForHouse({ level, residentialGroup }) {
  const facts = residentialGroup ? SOCIAL_CATEGORY[residentialGroup] : null;
  if (!facts) return Object.freeze({});

  /** @type {Record<string, number>} */
  const levels = {};
  for (const [tierLevel, tier] of Object.entries(facts.tiers)) {
    if (Number(tierLevel) <= level) {
      for (const [skill, skillLevel] of Object.entries(tier.skills)) {
        levels[skill] = Math.max(levels[skill] ?? 0, skillLevel);
      }
    }
  }
  return Object.freeze(levels);
}

/**
 * @param {{ level: number, residentialGroup: string | null }} params
 * @returns {ReadonlyArray<string>}
 */
export function getCitizenSkillsForHouse(params) {
  return Object.freeze(Object.keys(getCitizenSkillLevelsForHouse(params)));
}

/**
 * @param {{ level: number, residentialGroup: string | null }} house
 * @param {string} skillKey
 * @returns {number} 0 if the house's citizens don't hold this skill at all.
 */
export function getCitizenSkillLevel(house, skillKey) {
  return getCitizenSkillLevelsForHouse(house)[skillKey] ?? 0;
}

/**
 * @param {{ level: number, residentialGroup: string | null }} house
 * @param {string} skillKey
 * @returns {boolean}
 */
export function houseCitizenHasSkill(house, skillKey) {
  return getCitizenSkillLevel(house, skillKey) > 0;
}

/**
 * @param {{ level: number, residentialGroup: string | null }} house
 * @param {string} skillKey
 * @param {number} requiredLevel
 * @returns {boolean}
 */
export function houseCitizenHasSkillAtLevel(house, skillKey, requiredLevel) {
  return getCitizenSkillLevel(house, skillKey) >= (requiredLevel || 1);
}
