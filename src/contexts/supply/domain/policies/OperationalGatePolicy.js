import { isRoadNeedMet } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Building can trade/operate if its road need is met and it has its required
 * staff. The road need comes from the catalog (`requiresRoad`): a type that
 * needs no road is never held back by one. Without a `type` the road is required.
 *
 * @param {{ type?: string, roadCount?: number, worker?: number, workerNeed?: number }} params
 */
export function isOperational({ type, roadCount = 0, worker = 0, workerNeed = 0 } = {}) {
  const roadNeedMet = type === undefined ? (Number.isFinite(roadCount) ? roadCount : 0) > 0 : isRoadNeedMet(type, roadCount);
  if (!roadNeedMet) return false;

  const need = Number.isFinite(workerNeed) ? workerNeed : 0;
  const have = Number.isFinite(worker) ? worker : 0;
  if (need > 0 && have <= 0) return false;

  return true;
}

/**
 * The share of its full output a building makes with the staff it has: the workers present (the sick are not) over the workers it needs, at most 1. A building that needs
 * nobody makes it all. Once `isOperational` lets it work, this is how much it makes: a farm with one fieldhand of three yields a third of its harvest.
 *
 * @param {{ worker?: number, workerNeed?: number }} staffing
 * @returns {number} 0..1
 */
export function staffingShare({ worker = 0, workerNeed = 0 } = {}) {
  const need = Number.isFinite(workerNeed) ? workerNeed : 0;
  if (!(need > 0)) return 1;
  const have = Number.isFinite(worker) ? Math.max(0, worker) : 0;
  return Math.min(1, have / need);
}
