/**
 * Read model for Employment use cases (labor sources + workplaces).
 */
export function createEmploymentBuildingSnapshot({
  id,
  type = '',
  x = null,
  y = null,
  roadCount = 0,
  pop = 0,
  worker = 0,
  workerNeed = 0,
  sector = 0,
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('EmploymentBuildingSnapshot: id is required');
  }

  return Object.freeze({
    id,
    type: typeof type === 'string' ? type : '',
    x: typeof x === 'number' ? x : null,
    y: typeof y === 'number' ? y : null,
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    pop: Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0,
    worker: Number.isFinite(worker) ? Math.max(0, Math.floor(worker)) : 0,
    workerNeed: Number.isFinite(workerNeed) ? Math.max(0, Math.floor(workerNeed)) : 0,
    sector: Number.isFinite(sector) ? Math.floor(sector) : 0,
  });
}
