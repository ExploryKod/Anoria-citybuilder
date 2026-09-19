/**
 * Employment priority, scoped per tab (a social group, or the shared-skill
 * tab — see `HouseGroupSectorEligibilityPolicy.skillsForTab`). Replaces the
 * old flat 1–6 sector-priority scheme: a rank is only ever unique WITHIN the
 * tab it's set from (two different tabs can both have a rank-1 skill), never
 * globally, because each tab represents a different, non-competing labor
 * pool (see DistributeCityWorkers.js's own docstring on per-house skill
 * budgets).
 *
 * Same Caesar 3-style "no duplicate rank in scope" swap mechanic as before,
 * just re-scoped: `tabSkillIds` (the skills belonging to ONE tab, from
 * `skillsForTab`) stands in for the old fixed `[1, EMPLOYMENT_MAX_SECTORS]`
 * range.
 */

/**
 * Default rank for a skill with no stored override: its position in the
 * tab's own skill list (1-based) — stable, catalog-derived, no arbitrary
 * hand-authored table to keep in sync (unlike the old `DEFAULT_SECTOR_PRIORITIES`).
 * @param {string} skillId
 * @param {ReadonlyArray<string>} tabSkillIds
 * @returns {number}
 */
function defaultPriorityWithinTab(skillId, tabSkillIds) {
  const index = tabSkillIds.indexOf(skillId);
  return index === -1 ? tabSkillIds.length + 1 : index + 1;
}

/**
 * @param {string} skillId
 * @param {Record<string, number>} userPriorities
 * @param {ReadonlyArray<string>} tabSkillIds The skills in skillId's own tab.
 * @returns {number}
 */
export function resolveSkillPriorityValue(skillId, userPriorities = {}, tabSkillIds = []) {
  if (!skillId) return 99;
  if (userPriorities[skillId] !== undefined) {
    return userPriorities[skillId];
  }
  return defaultPriorityWithinTab(skillId, tabSkillIds);
}

/**
 * Every skill in this tab, resolved to a rank (user override or default) —
 * what the UI renders for one tab.
 * @param {Record<string, number>|null|undefined} userPriorities
 * @param {ReadonlyArray<string>} tabSkillIds
 * @returns {Record<string, number>}
 */
export function mergeTabPriorities(userPriorities, tabSkillIds) {
  const merged = {};
  for (const skillId of tabSkillIds) {
    merged[skillId] = resolveSkillPriorityValue(skillId, userPriorities ?? {}, tabSkillIds);
  }
  return merged;
}

/**
 * Caesar 3-style priority swap, scoped to one tab's skill list.
 * @param {string} skillId
 * @param {number} newPriority
 * @param {Record<string, number>} userPriorities Full stored map (every
 *   tab's overrides together — skill ids are globally unique, no collision).
 * @param {ReadonlyArray<string>} tabSkillIds The skills in skillId's own tab
 *   — both the clamp range and the swap scope.
 * @returns {Record<string, number>}
 */
export function swapSkillPriority(skillId, newPriority, userPriorities = {}, tabSkillIds = []) {
  const priorities = { ...userPriorities };
  const maxPriority = Math.max(1, tabSkillIds.length);
  const clampedPriority = Math.max(1, Math.min(maxPriority, newPriority));
  const currentPriority = resolveSkillPriorityValue(skillId, priorities, tabSkillIds);

  if (currentPriority === clampedPriority) {
    return priorities;
  }

  let skillWithNewPriority = null;
  for (const otherSkillId of tabSkillIds) {
    if (otherSkillId === skillId) continue;
    if (resolveSkillPriorityValue(otherSkillId, priorities, tabSkillIds) === clampedPriority) {
      skillWithNewPriority = otherSkillId;
      break;
    }
  }

  priorities[skillId] = clampedPriority;
  if (skillWithNewPriority !== null) {
    priorities[skillWithNewPriority] = currentPriority;
  }

  return priorities;
}
