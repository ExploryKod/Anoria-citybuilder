/**
 * Manhattan distance in tiles.
 */
export function manhattanDistance(a, b) {
  if (a?.x == null || a?.y == null || b?.x == null || b?.y == null) {
    return Infinity;
  }
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {number} maxDistance
 */
export function isWithinMarketRange(a, b, maxDistance = 5) {
  const max = Number.isFinite(maxDistance) && maxDistance > 0 ? maxDistance : 5;
  return manhattanDistance(a, b) <= max;
}
