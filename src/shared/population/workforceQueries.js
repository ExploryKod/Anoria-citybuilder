import { getBuildingDefinition } from '../building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY } from './socialCategoryCatalog.js';

/**
 * Whether the residents of a house look for a job: the catalog's `seeksWork` fact of their social category (omitted means they do). The city's
 * administrators do not: governing is not a post of the labour market, so they are neither hired, nor counted among the unemployed, nor paid
 * an unemployment benefit.
 * @param {string} houseType
 * @returns {boolean}
 */
export function houseSeeksWork(houseType) {
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  return !group || SOCIAL_CATEGORY[group]?.seeksWork !== false;
}

/**
 * Whether the residents of a house hold a skill: the highest level the catalog grants its social category at any tier up to the house's own.
 * Used for the administrators' functions (a house is an owner, or a tax collector, when it has residents and the skill is granted).
 * @param {string} houseType
 * @param {number} level the house's tier
 * @param {string} skill
 * @returns {boolean}
 */
export function houseHoldsSkill(houseType, level, skill) {
  return houseSkillLevel(houseType, level, skill) >= 1;
}

/**
 * The level at which the residents of a house hold a skill: the highest level the catalog grants its social category at any tier up to the house's own
 * (0 when none).
 * @param {string} houseType
 * @param {number} level the house's tier
 * @param {string} skill
 * @returns {number}
 */
export function houseSkillLevel(houseType, level, skill) {
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  const tiers = group ? SOCIAL_CATEGORY[group]?.tiers : null;
  if (!tiers) return 0;
  let best = 0;
  for (const [tier, facts] of Object.entries(tiers)) {
    if (Number(tier) <= level) best = Math.max(best, facts.skills[skill] ?? 0);
  }
  return best;
}

/**
 * Whether the social category of a house grants a skill at some tier (the house may not have reached it yet).
 * @param {string} houseType
 * @param {string} skill
 * @returns {boolean}
 */
export function groupGrantsSkill(houseType, skill) {
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  const tiers = group ? SOCIAL_CATEGORY[group]?.tiers : null;
  return Boolean(tiers) && Object.values(tiers).some((facts) => (facts.skills[skill] ?? 0) >= 1);
}

/**
 * Why the residents of ONE house are out of work. Posts are vacant that the house's own class could staff (its category grants the skill, at some
 * tier) but whose skill, at the level asked, the house has not acquired yet: as many of its unemployed as there are such posts are out of work for
 * lack of skills. The others find no post at all.
 *
 * @param {{
 *   unemployed: number,
 *   vacancies: ReadonlyArray<{ skill: string, level: number, vacancies: number }>,
 *   classGrants: (skill: string) => boolean,
 *   houseHolds: (skill: string, level: number) => boolean,
 * }} house `classGrants`: the house's class grants the skill at some tier; `houseHolds`: its residents hold the skill at that level now
 * @returns {{ noSkill: number, noPost: number }}
 */
export function houseUnemploymentCauses({ unemployed, vacancies, classGrants, houseHolds }) {
  const missedPosts = vacancies
    .filter((row) => row.vacancies > 0 && classGrants(row.skill) && !houseHolds(row.skill, row.level))
    .reduce((sum, row) => sum + row.vacancies, 0);
  const noSkill = Math.min(Math.max(0, unemployed), missedPosts);
  return { noSkill, noPost: Math.max(0, unemployed) - noSkill };
}

/**
 * The residents of a house that look for a job.
 * @param {string} houseType
 * @param {number} pop
 * @returns {number}
 */
export function residentsSeekingWork(houseType, pop) {
  return houseSeeksWork(houseType) ? pop : 0;
}
