/**
 * Greedy worker allocation.
 *
 * Priority (1 = highest) is resolved PER SKILL now, not per sector — see
 * SkillPriorityPolicy.js. It decides the order DistributeCityWorkers.js
 * visits skills in (so a house holding two skills at once sends its shared
 * labor to whichever skill the player ranked first). It does NOT decide
 * anything within a single (skill, level) bucket: every workplace in one
 * such bucket already requires the exact same skill, so a same-skill
 * priority lookup there was always a no-op tie — `orderWorkplacesByPriority`
 * below just computes deficits and preserves input order.
 */

/**
 * Resolve priority for a skill from a priority map. Missing skill -> lowest
 * priority (99), so an unranked skill never jumps ahead of a ranked one.
 *
 * @param {string} skillKey
 * @param {Record<string, number>} skillPriorities
 * @returns {number}
 */
export function resolveSkillPriority(skillKey, skillPriorities = {}) {
  if (!skillKey) return 99;
  const value = skillPriorities[skillKey];
  if (value !== undefined && Number.isFinite(value)) return value;
  return 99;
}

/**
 * Order skill keys ascending by priority (1 before 6) — the sequence
 * DistributeCityWorkers.js visits them in.
 *
 * @param {ReadonlyArray<string>} skillKeys
 * @param {Record<string, number>} skillPriorities
 * @returns {string[]}
 */
export function orderSkillsByPriority(skillKeys, skillPriorities = {}) {
  return [...skillKeys].sort(
    (a, b) => resolveSkillPriority(a, skillPriorities) - resolveSkillPriority(b, skillPriorities),
  );
}

/**
 * Workplaces from ONE (skill, level) bucket that still have a deficit,
 * preserving input order (no further sort — see module docstring).
 *
 * @param {Array<{ workerNeed?: number, worker?: number }>} workplaces
 * @returns {Array<{ workplace: object, deficit: number }>}
 */
export function orderWorkplacesByPriority(workplaces) {
  return workplaces
    .map((workplace) => {
      const need = workplace.workerNeed || 0;
      const have = workplace.worker || 0;
      const deficit = Math.max(0, need - have);
      return { workplace, deficit };
    })
    .filter((row) => row.deficit > 0);
}

/**
 * Allocate available workers greedily to ordered workplace rows.
 *
 * @param {number} availableWorkers
 * @param {Array<{ workplace: { id: string }, deficit: number }>} orderedRows
 * @returns {{ remaining: number, assignments: Array<{ buildingId: string, workers: number }> }}
 */
export function allocateWorkers(availableWorkers, orderedRows) {
  let remaining = Math.max(0, Math.floor(availableWorkers) || 0);
  const assignments = [];

  for (const row of orderedRows) {
    if (remaining <= 0) break;
    const workers = Math.min(remaining, row.deficit);
    if (workers <= 0) continue;
    assignments.push({ buildingId: row.workplace.id, workers });
    remaining -= workers;
  }

  return { remaining, assignments };
}
