/**
 * Social group -> eligible employment sectors.
 *
 * A house's `residentialGroup` (permanent fact from the shared building
 * catalog, keyed by color) determines which sectors its citizens may work
 * in. Sector 5 (Infrastructure/roads) is intentionally absent — it is open
 * to everyone, but `roads` needs 0 workers today so it never manifests as an
 * actual workplace (see `BuildingRolePolicy.isWorkplace`).
 *
 * Derived from shared/population/socialCategoryCatalog.js, the single
 * source for this category-level fact — see that file's header.
 */

import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';
import { allWorkplaceEmploymentSkills } from '../policies/WorkplaceSkillRequirementPolicy.js';

export const SOCIAL_GROUP_ARTISANS = 'artisans';
export const SOCIAL_GROUP_MERCHANTS = 'merchants';
export const SOCIAL_GROUP_SCHOLARS = 'scholars';

/** Priority-tab id for a skill granted to more than one social group (e.g. `spiritual`). */
export const SHARED_SKILL_TAB_ID = 'shared';

/** @type {Readonly<Record<string, ReadonlyArray<number>>>} */
export const GROUP_ELIGIBLE_SECTORS = Object.freeze(
  Object.fromEntries(
    Object.entries(SOCIAL_CATEGORY).map(([group, facts]) => [group, facts.eligibleSectors])
  )
);

/**
 * Derived from `buildingCatalog` (single source of truth for the static
 * `residentialGroup` fact per house color).
 * @type {Readonly<Record<string, string>>}
 */
export const RESIDENTIAL_GROUP_BY_TYPE = Object.freeze(
  Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, def]) => def.residentialGroup)
      .map(([id, def]) => [id, def.residentialGroup])
  )
);

/** @returns {ReadonlyArray<string>} */
export function allSocialGroups() {
  return Object.keys(GROUP_ELIGIBLE_SECTORS);
}

/**
 * @param {string} type House `type` field (e.g. `House-Red`).
 * @returns {string | null}
 */
export function residentialGroupForType(type) {
  return RESIDENTIAL_GROUP_BY_TYPE[type] ?? null;
}

/**
 * @param {string} group
 * @returns {ReadonlyArray<number>}
 */
export function eligibleSectorsForGroup(group) {
  return GROUP_ELIGIBLE_SECTORS[group] ?? [];
}

/**
 * Every skill id this group's tiers ever grant (all tiers, not level-bounded —
 * "could this group's citizens EVER hold this skill", unlike GroupSkillPolicy's
 * per-instance level resolution). Precise replacement for `eligibleSectors`
 * above where exactness matters (the priority UI): `eligibleSectors` is a
 * coarse, hand-authored per-group fact kept only for the HUD summary and can
 * disagree with the real skill grants (e.g. it lists sector 4 for artisans,
 * but Windmill's `stockage-alimentaire` is actually a scholars-only skill).
 * @param {string} group
 * @returns {ReadonlySet<string>}
 */
function allTierSkillsForGroup(group) {
  const tiers = SOCIAL_CATEGORY[group]?.tiers;
  const skills = new Set();
  if (!tiers) return skills;
  for (const tier of Object.values(tiers)) {
    for (const skillId of Object.keys(tier.skills)) {
      skills.add(skillId);
    }
  }
  return skills;
}

/**
 * @param {string} skillId
 * @returns {ReadonlyArray<string>} Every social group whose tiers grant this
 *   skill, in `allSocialGroups()` order. Empty for a skill no group grants
 *   (shouldn't happen for anything in `allWorkplaceEmploymentSkills()` — see
 *   the contract test pinning this).
 */
export function groupsForSkill(skillId) {
  return allSocialGroups().filter((group) => allTierSkillsForGroup(group).has(skillId));
}

/**
 * Workplace-relevant skills (i.e. required by at least one building — see
 * `allWorkplaceEmploymentSkills()`) granted to this group AND NO OTHER group.
 * A skill granted to 2+ groups belongs to the shared tab instead — see
 * `sharedWorkplaceSkills()`.
 * @param {string} group
 * @returns {ReadonlyArray<string>}
 */
export function exclusiveSkillsForGroup(group) {
  return allWorkplaceEmploymentSkills().filter((skillId) => {
    const groups = groupsForSkill(skillId);
    return groups.length === 1 && groups[0] === group;
  });
}

/**
 * Workplace-relevant skills granted to more than one social group (today:
 * `spiritual`, staffing Chapel — every group's tier 1 grants it so the city
 * can bootstrap before any house reaches tier 2).
 * @returns {ReadonlyArray<string>}
 */
export function sharedWorkplaceSkills() {
  return allWorkplaceEmploymentSkills().filter((skillId) => groupsForSkill(skillId).length > 1);
}

/**
 * Every employment-priority tab id: one per social group, plus
 * `SHARED_SKILL_TAB_ID` for skills more than one group provides. Derived
 * from `allSocialGroups()`, so a catalog-added 4th social category produces
 * a 4th tab with no code change here.
 * @returns {ReadonlyArray<string>}
 */
export function allPriorityTabs() {
  return [...allSocialGroups(), SHARED_SKILL_TAB_ID];
}

/**
 * @param {string} tabId A social group id, or `SHARED_SKILL_TAB_ID`.
 * @returns {ReadonlyArray<string>} The skills that tab's priority rows cover.
 */
export function skillsForTab(tabId) {
  return tabId === SHARED_SKILL_TAB_ID ? sharedWorkplaceSkills() : exclusiveSkillsForGroup(tabId);
}

/**
 * Inverse of `skillsForTab` — which tab a skill's own priority lives in, so
 * a caller holding just a skill id (e.g. the UI reacting to one row's input)
 * never needs to separately track or pass its tab.
 * @param {string} skillId
 * @returns {string} A social group id, or `SHARED_SKILL_TAB_ID`.
 */
export function tabForSkill(skillId) {
  const groups = groupsForSkill(skillId);
  return groups.length === 1 ? groups[0] : SHARED_SKILL_TAB_ID;
}
