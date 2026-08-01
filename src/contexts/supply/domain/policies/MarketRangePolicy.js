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

/**
 * Houses within Manhattan range of a market with road access.
 *
 * @param {{ x?: number, y?: number }} market
 * @param {object[]} buildings
 * @param {number} maxDistance
 * @returns {object[]}
 */
export function findHousesInMarketRange(market, buildings, maxDistance = 5) {
  if (!market || market.x == null || market.y == null) {
    return [];
  }

  return buildings.filter((house) => {
    const houseType = house.type || '';
    if (!houseType.includes('House') && !houseType.includes('house')) {
      return false;
    }
    if (house.x == null || house.y == null) {
      return false;
    }
    if (
      !isWithinMarketRange(
        { x: market.x, y: market.y },
        { x: house.x, y: house.y },
        maxDistance
      )
    ) {
      return false;
    }
    const roadCount = house.roads ?? house.roadCount ?? 0;
    return roadCount > 0;
  });
}

/**
 * @param {object} neighbor
 */
export function isFarmNeighborRef(neighbor) {
  const name = neighbor.type || neighbor.name || '';
  const type = neighbor.type || '';
  return (
    name.includes('Farm') ||
    name.includes('farm') ||
    type.includes('Farm') ||
    type.includes('farm') ||
    name.includes('Wheat') ||
    name.includes('Carrot') ||
    name.includes('Cabbage')
  );
}
