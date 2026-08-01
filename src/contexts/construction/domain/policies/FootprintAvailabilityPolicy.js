/**
 * Footprint checks / tile mutations on the in-memory city grid.
 * Pure — no Dexie / Three / DOM.
 */

/**
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function isRoadBuildingType(buildingType) {
  if (!buildingType) return false;
  return (
    buildingType === 'roads'
    || buildingType === 'Road'
    || buildingType.startsWith('StonePath-')
  );
}

/**
 * @param {{ size: number, tiles: object[][] }} city
 * @param {number} x
 * @param {number} y
 * @param {number} gridSize
 * @returns {boolean}
 */
export function isAreaAvailableForBuilding(city, x, y, gridSize) {
  if (gridSize === undefined || gridSize === null || gridSize < 1) {
    return false;
  }

  for (let dx = 0; dx < gridSize; dx++) {
    for (let dy = 0; dy < gridSize; dy++) {
      const checkX = x + dx;
      const checkY = y + dy;

      if (checkX >= city.size || checkY >= city.size || checkX < 0 || checkY < 0) {
        return false;
      }

      const tile = city.tiles?.[checkX]?.[checkY];
      if (tile?.buildingId !== undefined) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Clear buildingId/instanceId on the footprint anchored at (x, y).
 *
 * @param {{ size: number, tiles: object[][] }} city
 * @param {number} x
 * @param {number} y
 * @param {number} gridSize
 */
export function clearBuildingFootprint(city, x, y, gridSize) {
  for (let dx = 0; dx < gridSize; dx++) {
    for (let dy = 0; dy < gridSize; dy++) {
      const tileX = x + dx;
      const tileY = y + dy;
      if (tileX >= 0 && tileX < city.size && tileY >= 0 && tileY < city.size) {
        const tile = city.tiles?.[tileX]?.[tileY];
        if (tile) {
          tile.buildingId = undefined;
          tile.instanceId = undefined;
        }
      }
    }
  }
}

/**
 * Stamp buildingId/instanceId on the footprint.
 *
 * @param {{ size: number, tiles: object[][] }} city
 * @param {number} x
 * @param {number} y
 * @param {number} gridSize
 * @param {string} buildingType
 * @param {string} instanceId
 */
export function stampBuildingFootprint(city, x, y, gridSize, buildingType, instanceId) {
  for (let dx = 0; dx < gridSize; dx++) {
    for (let dy = 0; dy < gridSize; dy++) {
      const tileX = x + dx;
      const tileY = y + dy;
      const tile = city.tiles?.[tileX]?.[tileY];
      if (tile) {
        tile.buildingId = buildingType;
        tile.instanceId = instanceId;
      }
    }
  }
}

/**
 * @param {Record<string, { gridSize?: number }>} assetCatalog
 * @param {string | null | undefined} buildingType
 * @returns {number}
 */
export function resolveGridSize(assetCatalog, buildingType) {
  if (!buildingType) return 1;
  return assetCatalog?.[buildingType]?.gridSize || 1;
}
