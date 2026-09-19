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
 * @param {Record<string, { gridSize?: number, footprintWidth?: number, footprintDepth?: number, footprintHeight?: number }>} assetCatalog
 * @param {string | null | undefined} buildingType
 * @param {number} [rotationStep]
 * @returns {{ width: number, height: number, gridSize: number }}
 */
export function resolveFootprintDimensions(assetCatalog, buildingType, rotationStep = 0) {
  const entry = assetCatalog?.[buildingType];
  const baseWidth = entry?.footprintWidth ?? entry?.gridSize ?? 1;
  const baseHeight = entry?.footprintDepth ?? entry?.footprintHeight ?? entry?.gridSize ?? 1;
  const normalizedStep = ((rotationStep % 4) + 4) % 4;
  const swap = normalizedStep % 2 === 1;
  const width = swap ? baseHeight : baseWidth;
  const height = swap ? baseWidth : baseHeight;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    gridSize: Math.max(width, height),
  };
}

/**
 * @param {{ size: number, tiles: object[][] }} city
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} [height]
 * @returns {boolean}
 */
export function isAreaAvailableForBuilding(city, x, y, width, height = width) {
  const footprintWidth = width ?? 1;
  const footprintHeight = height ?? footprintWidth;
  if (footprintWidth < 1 || footprintHeight < 1) {
    return false;
  }

  for (let dx = 0; dx < footprintWidth; dx++) {
    for (let dy = 0; dy < footprintHeight; dy++) {
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
 * @param {number} width
 * @param {number} [height]
 */
export function clearBuildingFootprint(city, x, y, width, height = width) {
  const footprintWidth = width ?? 1;
  const footprintHeight = height ?? footprintWidth;
  for (let dx = 0; dx < footprintWidth; dx++) {
    for (let dy = 0; dy < footprintHeight; dy++) {
      const tileX = x + dx;
      const tileY = y + dy;
      if (tileX >= 0 && tileX < city.size && tileY >= 0 && tileY < city.size) {
        const tile = city.tiles?.[tileX]?.[tileY];
        if (tile) {
          tile.buildingId = undefined;
          tile.instanceId = undefined;
          delete tile.placementRotationStep;
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
 * @param {number} width
 * @param {string} buildingType
 * @param {string} instanceId
 * @param {{ footprintHeight?: number, placementRotationStep?: number }} [options]
 */
export function stampBuildingFootprint(city, x, y, width, buildingType, instanceId, options = {}) {
  const footprintWidth = width ?? 1;
  const footprintHeight = options.footprintHeight ?? footprintWidth;
  const placementRotationStep = options.placementRotationStep ?? 0;
  for (let dx = 0; dx < footprintWidth; dx++) {
    for (let dy = 0; dy < footprintHeight; dy++) {
      const tileX = x + dx;
      const tileY = y + dy;
      const tile = city.tiles?.[tileX]?.[tileY];
      if (tile) {
        tile.buildingId = buildingType;
        tile.instanceId = instanceId;
        if (dx === 0 && dy === 0 && placementRotationStep > 0) {
          tile.placementRotationStep = placementRotationStep;
        } else if (dx === 0 && dy === 0) {
          delete tile.placementRotationStep;
        }
      }
    }
  }
}

/**
 * @param {Record<string, { gridSize?: number, footprintWidth?: number, footprintDepth?: number }>} assetCatalog
 * @param {string | null | undefined} buildingType
 * @param {number} [rotationStep]
 * @returns {number}
 */
export function resolveGridSize(assetCatalog, buildingType, rotationStep = 0) {
  if (!buildingType) return 1;
  return resolveFootprintDimensions(assetCatalog, buildingType, rotationStep).gridSize;
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
 * @param {Record<string, { gridSize?: number, footprintWidth?: number, footprintDepth?: number }>} params.assetCatalog
 * @param {number} [params.rotationStep]
 * @returns {{ ok: boolean, reason?: string, gridSize: number, footprintWidth: number, footprintHeight: number }}
 */
export function canPlaceBuildingAtTile({
  city,
  x,
  y,
  buildingType,
  assetCatalog,
  rotationStep = 0,
}) {
  const { width, height, gridSize } = resolveFootprintDimensions(
    assetCatalog,
    buildingType,
    rotationStep,
  );
  const tile = city?.tiles?.[x]?.[y];
  if (!tile) {
    return { ok: false, reason: 'out_of_bounds', gridSize, footprintWidth: width, footprintHeight: height };
  }

  if (isRoadBuildingType(buildingType)) {
    const ok = !tile.buildingId || isRoadBuildingType(tile.buildingId);
    return {
      ok,
      reason: ok ? undefined : 'area_not_available',
      gridSize,
      footprintWidth: width,
      footprintHeight: height,
    };
  }

  const ok = isAreaAvailableForBuilding(city, x, y, width, height);
  return {
    ok,
    reason: ok ? undefined : 'area_not_available',
    gridSize,
    footprintWidth: width,
    footprintHeight: height,
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
