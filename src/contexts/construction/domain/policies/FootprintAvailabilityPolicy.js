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

/**
 * Pure placement gate (footprint / road overwrite). Shared by PlaceBuildingAtTile and ghost preview.
 * Does not check funds or Dexie.
 *
 * @param {object} params
 * @param {{ size: number, tiles: object[][] }} params.city
 * @param {number} params.x
 * @param {number} params.y
 * @param {string} params.buildingType
 * @param {Record<string, { gridSize?: number }>} params.assetCatalog
 * @returns {{ ok: boolean, reason?: string, gridSize: number }}
 */
export function canPlaceBuildingAtTile({ city, x, y, buildingType, assetCatalog }) {
  const gridSize = resolveGridSize(assetCatalog, buildingType);
  const tile = city?.tiles?.[x]?.[y];
  if (!tile) {
    return { ok: false, reason: 'out_of_bounds', gridSize };
  }

  if (isRoadBuildingType(buildingType)) {
    const ok = !tile.buildingId || isRoadBuildingType(tile.buildingId);
    return {
      ok,
      reason: ok ? undefined : 'area_not_available',
      gridSize,
    };
  }

  const ok = isAreaAvailableForBuilding(city, x, y, gridSize);
  return {
    ok,
    reason: ok ? undefined : 'area_not_available',
    gridSize,
  };
}

/**
 * Resolve the NW/min footprint anchor for a multi-tile building from any occupied tile.
 * Falls back to (x, y) when instanceId is missing or not found on the grid.
 *
 * @param {{ size: number, tiles: object[][] }} city
 * @param {number} x
 * @param {number} y
 * @param {string | null | undefined} instanceId
 * @returns {{ x: number, y: number }}
 */
export function findFootprintAnchor(city, x, y, instanceId) {
  if (!instanceId || !city?.tiles) {
    return { x, y };
  }

  let minX = Infinity;
  let minY = Infinity;
  const size = city.size ?? 0;

  for (let ix = 0; ix < size; ix++) {
    for (let iy = 0; iy < size; iy++) {
      if (city.tiles[ix]?.[iy]?.instanceId === instanceId) {
        if (ix < minX) minX = ix;
        if (iy < minY) minY = iy;
      }
    }
  }

  if (minX === Infinity || minY === Infinity) {
    return { x, y };
  }

  return { x: minX, y: minY };
}
