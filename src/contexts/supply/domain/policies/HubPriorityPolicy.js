import { manhattanDistance } from './ResourceRangePolicy.js';

/**
 * Which hub a distributor draws on first when several are within its reach (a market and its granaries): the nearest, and among equally near ones the first in the order of
 * orientations that the catalog declares on the link (`hubLink.directionOrder`: every orientation, once, in the order they win a tie). Pure, resource-agnostic.
 *
 * The orientation is the one of the hub seen from the distributor, on the tile grid: north is toward smaller `y`, east toward larger `x`. Two hubs that are as near and in the same
 * orientation are told apart as every ranking of the supply is: by `y`, then `x`, then id.
 */

/** The eight orientations a hub can lie in, from a distributor (the ids a catalog's `directionOrder` is made of). */
export const DIRECTIONS = Object.freeze(['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']);

/**
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @returns {string} one of DIRECTIONS: the eighth of the compass `to` lies in, seen from `from`
 */
export function directionOf(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) throw new Error(`[hub-priority] a hub on the very tile of the distributor (${from.x}, ${from.y}) has no orientation`);
  const horizontal = dx > 0 ? 'east' : 'west';
  const vertical = dy > 0 ? 'south' : 'north';
  // Within half a right angle of an axis it is that axis' direction, otherwise the diagonal (|d| ratio 2:1 is the limit).
  if (Math.abs(dx) >= 2 * Math.abs(dy)) return horizontal;
  if (Math.abs(dy) >= 2 * Math.abs(dx)) return vertical;
  return `${vertical}-${horizontal}`;
}

/**
 * An order of orientations must name each of the eight once: a catalog that forgets one would leave its hubs unranked, silently.
 * @param {ReadonlyArray<string>} directionOrder
 * @returns {ReadonlyArray<string>} the same order
 */
export function assertDirectionOrder(directionOrder) {
  const named = [...(directionOrder ?? [])].sort().join(',');
  if (named !== [...DIRECTIONS].sort().join(',')) {
    throw new Error(`[hub-priority] a directionOrder lists each of ${DIRECTIONS.join(', ')} exactly once, got ${JSON.stringify(directionOrder)}`);
  }
  return directionOrder;
}

/**
 * Hubs ordered by priority for a distributor at `pos`: nearest first, then by the catalog's order of orientations, then by `y`, `x` and id.
 * @template {{ id: string, x: number, y: number }} Hub
 * @param {{ x: number, y: number }} pos
 * @param {ReadonlyArray<Hub>} hubs
 * @param {ReadonlyArray<string>} [directionOrder] every orientation once; omitted: nearest, then `y`, `x`, id (a link that declares no order)
 * @returns {Hub[]}
 */
export function rankHubsByPriority(pos, hubs, directionOrder) {
  const order = directionOrder ? assertDirectionOrder(directionOrder) : null;
  const rank = (hub) => (order ? order.indexOf(directionOf(pos, hub)) : 0);
  return [...hubs].sort((a, b) => {
    const distance = manhattanDistance(pos, a) - manhattanDistance(pos, b);
    if (distance !== 0) return distance;
    const direction = rank(a) - rank(b);
    if (direction !== 0) return direction;
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id.localeCompare(b.id);
  });
}
