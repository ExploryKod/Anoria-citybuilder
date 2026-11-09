import { isOperational, staffingShare } from './OperationalGatePolicy.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * The room a hub keeps for the harvest still to come. The fields yield once a year, all at once: a hub that the cheapest goods of the world had filled would refuse the harvest of
 * the fields (and it would go bad unsold). An import therefore takes only the room left after the harvest to come. Pure: the producers are given.
 */

/**
 * The units the standing fields of a good will still bring in this year: those that have not yielded yet and that work, each at the share its staff makes of it.
 * @param {{ producers: ReadonlyArray<object>, good: string, year: number }} params the producer snapshots of the good (type, roads, staff and the field of their yearly lock)
 * @returns {number}
 */
export function harvestToCome({ producers, good, year }) {
  let toCome = 0;
  for (const producer of producers) {
    const entry = getResourceRoles(producer.type).find((role) => role.role === 'producer' && role.categories.includes(good) && role.periodLock?.unit === 'year');
    if (!entry) continue;
    if (!isOperational({ type: producer.type, roadCount: producer.roadCount, worker: producer.worker, workerNeed: producer.workerNeed })) continue;
    if (producer[entry.periodLock.field] !== year) toCome += entry.amount * staffingShare({ worker: producer.worker, workerNeed: producer.workerNeed });
  }
  return toCome;
}

/**
 * What one hub keeps free for it: the harvest to come, shared among the hubs that hold the good.
 * @param {{ toCome: number, hubCount: number }} params
 * @returns {number} units
 */
export function harvestReservePerHub({ toCome, hubCount }) {
  return Math.ceil(toCome / Math.max(1, hubCount));
}
