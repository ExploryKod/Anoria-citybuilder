/**
 * Greedy worker allocation by sector priority (1 = highest).
 */

/**
 * Resolve priority for a sector from a priority map.
 * Missing / sector 0 → lowest priority (99).
 *
 * @param {number} sector
 * @param {Record<number|string, number>} sectorPriorities
 * @returns {number}
 */
export function resolveSectorPriority(sector, sectorPriorities = {}) {
  if (!sector || sector === 0) return 99;
  const value = sectorPriorities[sector];
  if (value !== undefined && Number.isFinite(value)) return value;
  return 99;
}

/**
 * Sort workplaces by ascending priority (1 before 6).
 *
 * @param {Array<{ sector?: number, workerNeed?: number, worker?: number }>} workplaces
 * @param {Record<number|string, number>} sectorPriorities
 * @returns {Array<{ workplace: object, priority: number, deficit: number }>}
 */
export function orderWorkplacesByPriority(workplaces, sectorPriorities = {}) {
  return workplaces
    .map((workplace) => {
      const need = workplace.workerNeed || 0;
      const have = workplace.worker || 0;
      const deficit = Math.max(0, need - have);
      const priority = resolveSectorPriority(workplace.sector, sectorPriorities);
      return { workplace, priority, deficit };
    })
    .filter((row) => row.deficit > 0)
    .sort((a, b) => a.priority - b.priority);
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
