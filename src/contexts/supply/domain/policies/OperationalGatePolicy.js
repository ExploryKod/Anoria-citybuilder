/**
 * Building can trade/operate if it has road access and required staff.
 *
 * @param {{ roadCount?: number, worker?: number, workerNeed?: number }} params
 */
export function isOperational({ roadCount = 0, worker = 0, workerNeed = 0 } = {}) {
  const roads = Number.isFinite(roadCount) ? roadCount : 0;
  if (roads <= 0) return false;

  const need = Number.isFinite(workerNeed) ? workerNeed : 0;
  const have = Number.isFinite(worker) ? worker : 0;
  if (need > 0 && have <= 0) return false;

  return true;
}
