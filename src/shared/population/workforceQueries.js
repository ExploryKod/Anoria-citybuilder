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
 * The businesses of a house, as its social category declares them, and the one the Enterprises tab opens on: the only one, or the one flagged
 * `default: true`. A house with none, or with several and no default (or several defaults), is an error: the tab would not know what to show.
 * @param {string} houseType
 * @returns {{ enterprises: ReadonlyArray<{ id: string, label: string, activity: string }>, defaultId: string }}
 */
export function houseEnterprises(houseType) {
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  const enterprises = SOCIAL_CATEGORY[group]?.enterprises;
  if (!Array.isArray(enterprises) || enterprises.length === 0) throw new Error(`[enterprises] house type "${houseType}" (category "${group}") declares no enterprise`);
  const flagged = enterprises.filter((enterprise) => enterprise.default === true);
  if (flagged.length > 1) throw new Error(`[enterprises] category "${group}" flags several default enterprises: ${flagged.map((enterprise) => enterprise.id).join(', ')}`);
  if (flagged.length === 0 && enterprises.length > 1) throw new Error(`[enterprises] category "${group}" has several enterprises and flags none as default`);
  return { enterprises, defaultId: (flagged[0] ?? enterprises[0]).id };
}

/**
 * The share of a house set aside for its business, a fraction: the `premisesShare` of the enterprise that makes and sells goods (see the catalog), or
 * 0 for a house with no such business (the administrators'). A business that declares no share is an error: its rent could not be split from the home's.
 * @param {string} houseType
 * @returns {number}
 */
export function premisesShareOf(houseType) {
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  const business = SOCIAL_CATEGORY[group]?.enterprises?.find((enterprise) => enterprise.activity === 'recipes');
  if (!business) return 0;
  if (!(business.premisesShare >= 0 && business.premisesShare < 1)) throw new Error(`[premises] the "${business.id}" business of category "${group}" must declare a premisesShare (a fraction below 1), got ${business.premisesShare}`);
  return business.premisesShare;
}

/**
 * The enterprise of a house that does an activity (`recipes`: makes and sells goods, `rental`: lets the houses): the one its money is booked on.
 * A house with none, or with several that do the same, is an error: the line would not know whose it is.
 * @param {string} houseType
 * @param {'recipes' | 'rental'} activity
 * @returns {{ id: string, label: string, activity: string }}
 */
export function houseEnterpriseOf(houseType, activity) {
  const doing = houseEnterprises(houseType).enterprises.filter((enterprise) => enterprise.activity === activity);
  if (doing.length !== 1) throw new Error(`[enterprises] house type "${houseType}" has ${doing.length} enterprises doing "${activity}": exactly one is needed to book its lines`);
  return doing[0];
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
 * The house level at which the residents of a house came to hold a skill at the level they hold it now: the lowest tier, up to the house's own, whose grant reaches that level.
 * It is the number the player reads on a skill ("niv. N"), the one a workplace of that skill shows on its card (see lowestHouseTierForWorkers): a skill of level N comes with a
 * house of level N and staffs the workplaces of level N. It differs from `houseSkillLevel`, the skill's own scale (medicine 1, then 2), which the workplaces ask for.
 * @param {string} houseType
 * @param {number} level the house's tier
 * @param {string} skill
 * @returns {number} 0 when the house does not hold the skill
 */
export function houseSkillTier(houseType, level, skill) {
  const held = houseSkillLevel(houseType, level, skill);
  if (held < 1) return 0;
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  const tiers = Object.entries(SOCIAL_CATEGORY[group].tiers)
    .map(([tier, facts]) => ({ tier: Number(tier), reached: facts.skills[skill] ?? 0 }))
    .filter((entry) => entry.tier <= level && entry.reached >= held)
    .map((entry) => entry.tier);
  return Math.min(...tiers);
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
 * The skills a house does not hold yet but its social category grants at a higher tier, each with the lowest tier that grants it.
 * @param {string} houseType
 * @param {number} level the house's tier
 * @returns {ReadonlyArray<{ skill: string, tier: number }>} in order of tier
 */
export function upcomingHouseSkills(houseType, level) {
  const group = getBuildingDefinition(houseType)?.residentialGroup;
  const tiers = group ? SOCIAL_CATEGORY[group]?.tiers : null;
  if (!tiers) return [];
  const upcoming = [];
  for (const tier of Object.keys(tiers).map(Number).sort((a, b) => a - b)) {
    if (tier <= level) continue;
    for (const [skill, skillLevel] of Object.entries(tiers[tier].skills)) {
      if (skillLevel >= 1 && houseSkillLevel(houseType, level, skill) < 1 && !upcoming.some((entry) => entry.skill === skill)) {
        upcoming.push({ skill, tier });
      }
    }
  }
  return upcoming;
}

/**
 * The house tier from which a building can be given workers: the lowest tier, over every social category whose residents look for a job, that grants the
 * skill at the level the building asks. A skill no such tier grants is an error: the building could never be staffed.
 * @param {string} skill the building's `employment.requiredSkill`
 * @param {number} level the building's `employment.requiredSkillLevel`
 * @returns {number}
 */
export function lowestHouseTierForWorkers(skill, level) {
  let lowest = null;
  for (const [group, category] of Object.entries(SOCIAL_CATEGORY)) {
    if (category.seeksWork === false) continue;
    for (const [tier, facts] of Object.entries(category.tiers)) {
      if ((facts.skills[skill] ?? 0) >= level && (lowest === null || Number(tier) < lowest)) lowest = Number(tier);
    }
  }
  if (lowest === null) throw new Error(`[workforce] no house tier of a category that looks for work grants the skill "${skill}" at level ${level}: its workplaces could never be staffed`);
  return lowest;
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
