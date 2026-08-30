/**
 * Zone grid helpers for terrain that extends past the playable city (beach border).
 *
 * @param {number} citySize
 * @param {number} zoneSize
 * @param {number} [zonePadding=0] — extra zone rings outside the city on each side
 */
export function getTerrainZoneCounts(citySize, zoneSize, zonePadding = 0) {
  const playableZonesX = Math.ceil(citySize / zoneSize);
  const playableZonesY = Math.ceil(citySize / zoneSize);
  return {
    numZonesX: playableZonesX + zonePadding * 2,
    numZonesY: playableZonesY + zonePadding * 2,
    zonePadding,
  };
}

/**
 * @param {number} x — tile column (may be negative for beach border)
 * @param {number} y — tile row
 * @param {number} citySize
 * @param {number} zoneSize
 * @param {number} [zonePadding=0]
 * @returns {number | null}
 */
export function resolveTerrainZoneIndex(x, y, citySize, zoneSize, zonePadding = 0) {
  const { numZonesX, numZonesY } = getTerrainZoneCounts(citySize, zoneSize, zonePadding);
  const zoneX = Math.floor(x / zoneSize) + zonePadding;
  const zoneY = Math.floor(y / zoneSize) + zonePadding;

  if (zoneX < 0 || zoneY < 0 || zoneX >= numZonesX || zoneY >= numZonesY) {
    return null;
  }

  return zoneX * numZonesY + zoneY;
}
