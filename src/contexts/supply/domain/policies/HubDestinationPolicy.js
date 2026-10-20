import { isOperational } from './OperationalGatePolicy.js';
import { manhattanDistance } from './ResourceRangePolicy.js';
import { getCategoriesForRole } from './ResourceRolePolicy.js';
import { normalizeHubStorageOrders, getHubProductRemainingInbound } from './HubStorageOrdersPolicy.js';

/**
 * Where goods that need a place go: a producer selling to a hub, a hub being emptied. The hubs that can take the
 * good, best first — one ranking for everyone, so the storage orders mean the same wherever goods come from:
 *  1. the hubs whose order for that good is "fetch" (bring it here) come before any other;
 *  2. then the nearest (Manhattan distance from where the goods are);
 *  3. on a tie, the one with the most room, then the identifier (so the same goods always go the same way).
 * A hub is left out when it does not store that good, is not working (no road or no staff), refuses it or is
 * emptying it, or has no room left (for the good's own ceiling, and the hub's shared space).
 */

/**
 * @param {object} params
 * @param {Array<object>} params.hubs Hub snapshots (type, x, y, stocks, maxStock, roadCount, worker, workerNeed, hubStorageOrders).
 * @param {string} params.category The good to place.
 * @param {{ x: number, y: number }} params.from Where the goods are now.
 * @param {string | null} [params.excludeId] A hub not to send it to (the one being emptied).
 * @param {(hub: object) => boolean} [params.inReach] Whether a hub can be served from where the goods are (its collector range).
 * @returns {Array<{ hub: object, room: number, mode: string }>}
 */
export function rankHubDestinations({ hubs, category, from, excludeId = null, inReach = () => true }) {
  const candidates = [];
  for (const hub of hubs) {
    if (hub.id === excludeId || hub.x == null || hub.y == null || !inReach(hub)) continue;
    const productIds = getCategoriesForRole(hub.type, 'hub');
    if (!productIds.includes(category)) continue;
    if (!isOperational({ type: hub.type, roadCount: hub.roadCount, worker: hub.worker, workerNeed: hub.workerNeed })) continue;

    const orders = normalizeHubStorageOrders(hub.hubStorageOrders, productIds);
    const room = getHubProductRemainingInbound({
      productId: category,
      productIds,
      orders,
      stocks: hub.stocks ?? {},
      totalCapacity: hub.maxStock,
    });
    if (!(room > 0)) continue;
    candidates.push({ hub, room, mode: orders[category].mode });
  }

  return candidates.sort(
    (a, b) =>
      Number(b.mode === 'fetch') - Number(a.mode === 'fetch') ||
      manhattanDistance(from, a.hub) - manhattanDistance(from, b.hub) ||
      b.room - a.room ||
      a.hub.id.localeCompare(b.hub.id)
  );
}
