/** Tools that must never drive a placement ghost (UI / zones / non-mesh). */
const NON_PLACEABLE_TOOL_IDS = new Set([
  'bulldoze',
  'select-object',
  'grass',
  'terrain',
  'industry', // toolbar category id, not an asset
  'bilan',
  'loans',
  'compte-de-resultat',
  'journal',
  'tutorial',
  'objectives',
  '',
]);

/**
 * Visual mesh for ghost preview. Domain still validates with the real tool id.
 * Modern `roads` are terrain-textured in-scene; preview reuses StonePath mesh.
 * @param {string} assetId
 * @returns {string}
 */
export function resolveGhostVisualAssetId(assetId) {
  if (assetId === 'roads' || assetId === 'Road') {
    return 'StonePath-001';
  }
  return assetId;
}

/**
 * @param {string | null | undefined} toolId
 * @param {Record<string, unknown>} assetCatalog
 * @returns {boolean}
 */
export function isPlaceableBuildingTool(toolId, assetCatalog) {
  if (!toolId || NON_PLACEABLE_TOOL_IDS.has(toolId)) {
    return false;
  }
  return Boolean(assetCatalog?.[toolId]);
}

/**
 * Orchestrates placement ghost: tool + tile → domain canPlace → visual show/clear.
 * Owns no Three.js meshes; no city writes.
 *
 * @param {object} deps
 * @param {() => { show: Function, clear: Function } | null | undefined} deps.getGhost
 * @param {() => { size: number, tiles: object[][] } | null | undefined} deps.getCity
 * @param {() => string} deps.getActiveToolId
 * @param {() => string} deps.getEffectiveAssetId
 * @param {Record<string, { gridSize?: number, price?: number, category?: string }>} deps.assetCatalog
 * @param {(toolId: string) => boolean} [deps.isPlaceableTool]
 * @param {(params: object) => { ok: boolean, reason?: string, gridSize: number }} deps.canPlaceBuildingAtTile
 * @param {() => object | null | undefined} [deps.getFocusedObject]
 */
/**
 * @param {number} x
 * @param {number} y
 * @param {{ x: number, y: number, gridSize: number } | null} footprint
 */
function isTileInFootprint(x, y, footprint) {
  if (!footprint) return false;
  const size = footprint.gridSize ?? 1;
  return x >= footprint.x && x < footprint.x + size && y >= footprint.y && y < footprint.y + size;
}

export function createPlacementGhostSession({
  getGhost,
  getCity,
  getActiveToolId,
  getEffectiveAssetId,
  assetCatalog,
  isPlaceableTool = (toolId) => isPlaceableBuildingTool(toolId, assetCatalog),
  canPlaceBuildingAtTile,
  getFocusedObject = () => null,
}) {
  /** @type {object | null} */
  let lastFocused = null;
  /** Footprint hidden until hover leaves the tile(s) just placed. */
  let suppressFootprint = null;

  function clear() {
    suppressFootprint = null;
    getGhost()?.clear();
  }

  /**
   * Hide preview on tiles where a building was just placed (avoids red ghost on success).
   * @param {number} x
   * @param {number} y
   * @param {number} [gridSize]
   */
  function suppressGhostAtFootprint(x, y, gridSize = 1) {
    suppressFootprint = { x, y, gridSize: Math.max(1, gridSize) };
    getGhost()?.clear();
  }

  /**
   * @param {object | null} [focused]
   */
  function sync(focused) {
    if (getGhost()?.anchored) {
      return;
    }

    const resolved = focused === undefined ? (lastFocused ?? getFocusedObject()) : focused;
    if (focused !== undefined) {
      lastFocused = focused;
    }

    const ghost = getGhost();
    if (!ghost) return;

    const toolId = getActiveToolId();
    if (!isPlaceableTool(toolId)) {
      ghost.clear();
      return;
    }

    const x = resolved?.userData?.x;
    const y = resolved?.userData?.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      // No tile under pointer/finger — clear hover ghost (desktop leave / touch lift off-map).
      ghost.clear();
      return;
    }

    if (suppressFootprint) {
      if (isTileInFootprint(x, y, suppressFootprint)) {
        ghost.clear();
        return;
      }
      suppressFootprint = null;
    }

    const city = getCity();
    const assetId = getEffectiveAssetId();
    if (!assetId || !city) {
      ghost.clear();
      return;
    }

    const placement = canPlaceBuildingAtTile({
      city,
      x,
      y,
      buildingType: assetId,
      assetCatalog,
    });

    ghost.show(resolveGhostVisualAssetId(assetId), x, y, placement.ok, {
      gridSize: placement.gridSize ?? assetCatalog?.[assetId]?.gridSize ?? 1,
    });
  }

  function onToolChanged() {
    clear();
    sync(lastFocused ?? getFocusedObject());
  }

  return {
    sync,
    clear,
    suppressGhostAtFootprint,
    onToolChanged,
  };
}
