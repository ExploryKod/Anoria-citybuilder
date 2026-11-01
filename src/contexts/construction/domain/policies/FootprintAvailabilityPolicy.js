import { isRoadType } from '../../../../shared/building-catalog/roadQueries.js';
/**
 * Footprint checks / tile mutations on the in-memory city grid.
 * Pure — no Dexie / Three / DOM.
 */

/**
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function isRoadBuildingType(buildingType) {
  return isRoadType(buildingType);
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

/** Two grounds are one level when they are this close (the levels of a map are steps of half a tile). */
const SAME_LEVEL_TOLERANCE = 0.01;
/** The ground of a tile with no relief: plain grass. */
const PLAIN_GROUND = Object.freeze({ elevation: 0, flat: true, obstacle: false, slope: null });

/**
 * What the ground of the footprint says about building on it. A tile carries a `relief` ({ elevation, flat }) when its map has one (a map layout), and has
 * none on plain grass, which is flat and of one level. A building stands on flat ground only, and on a single level: a footprint straddling two levels would
 * float over the lower tile or sink into the higher one.
 * A tree, a rock... standing on a tile of the footprint is in the way (`ground_obstructed`).
 * @returns {'ground_obstructed' | 'ground_not_flat' | 'ground_not_level' | null} why the footprint cannot be built on, or null
 */
export function groundRefusal(city, x, y, width, height = width, { allowSlope = false } = {}) {
  let level = null;
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < height; dy++) {
      const tile = city.tiles?.[x + dx]?.[y + dy];
      // Land the town hall has put up for sale is fenced: nothing is built on it
      if (tile?.plot) return 'ground_plot';
      const relief = tile?.relief ?? PLAIN_GROUND;
      if (relief.obstacle) return 'ground_obstructed';
      // A slope is not flat: a road follows it (`allowSlope`), a building never stands on it
      if (!relief.flat && !(allowSlope && relief.slope)) return 'ground_not_flat';
      level ??= relief.elevation;
      if (Math.abs(relief.elevation - level) > SAME_LEVEL_TOLERANCE) return 'ground_not_level';
    }
  }
  return null;
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
    const free = !tile.buildingId || isRoadBuildingType(tile.buildingId);
    const groundReason = free ? groundRefusal(city, x, y, 1, 1, { allowSlope: true }) : null;
    return {
      ok: free && !groundReason,
      reason: free ? (groundReason ?? undefined) : 'area_not_available',
      gridSize,
      footprintWidth: width,
      footprintHeight: height,
    };
  }

  const free = isAreaAvailableForBuilding(city, x, y, width, height);
  const groundReason = free ? groundRefusal(city, x, y, width, height) : null;
  return {
    ok: free && !groundReason,
    reason: free ? (groundReason ?? undefined) : 'area_not_available',
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
