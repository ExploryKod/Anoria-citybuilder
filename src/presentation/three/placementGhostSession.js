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
 * Visual mesh id for ghost preview. Domain still validates with the real tool id.
 * Roads reuse StonePath mesh; Kenney buildings use their own GLB via placementGhost.
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
 * Whether R should spin the placement ghost instead of rotating the camera (build behavior).
 * @param {string | null | undefined} toolId
 * @param {Record<string, unknown>} assetCatalog
 * @param {{ isEditorPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function supportsPlacementGhostRotation(toolId, assetCatalog, options = {}) {
  if (!toolId || NON_PLACEABLE_TOOL_IDS.has(toolId)) {
    return false;
  }
  if (options.isEditorPlacementTool?.(toolId)) {
    return true;
  }
  return isPlaceableBuildingTool(toolId, assetCatalog);
}

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

/**
 * Orchestrates placement ghost: tool + tile → domain canPlace → visual show/clear.
 *
 * @param {object} deps
 * @param {() => { show: Function, clear: Function, rotationStep?: number } | null | undefined} deps.getGhost
 * @param {() => { size: number, tiles: object[][] } | null | undefined} deps.getCity
 * @param {() => string} deps.getActiveToolId
 * @param {() => string} deps.getEffectiveAssetId
 * @param {Record<string, { gridSize?: number, price?: number, category?: string }>} deps.assetCatalog
 * @param {(toolId: string) => boolean} [deps.isPlaceableTool]
 * @param {(params: object) => { ok: boolean, reason?: string, gridSize: number, footprintWidth?: number, footprintHeight?: number }} deps.canPlaceBuildingAtTile
 * @param {(x: number, y: number) => number | null | undefined} [deps.getPlacementAnchorLocalY]
 * @param {() => object | null | undefined} [deps.getFocusedObject]
 */
export function createPlacementGhostSession({
  getGhost,
  getCity,
  getActiveToolId,
  getEffectiveAssetId,
  assetCatalog,
  isPlaceableTool = (toolId) => isPlaceableBuildingTool(toolId, assetCatalog),
  canPlaceBuildingAtTile,
  getPlacementAnchorLocalY = () => null,
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

    const rotationStep = getGhost()?.rotationStep ?? 0;

    const placement = canPlaceBuildingAtTile({
      city,
      x,
      y,
      buildingType: assetId,
      assetCatalog,
      rotationStep,
    });

    const ghostGridSize = Math.max(
      placement.footprintWidth ?? 1,
      placement.footprintHeight ?? 1,
      placement.gridSize ?? assetCatalog?.[assetId]?.gridSize ?? 1,
    );

    const placementBaseLocalY = getPlacementAnchorLocalY(x, y);

    ghost.show(resolveGhostVisualAssetId(assetId), x, y, placement.ok, {
      gridSize: ghostGridSize,
      footprintWidth: placement.footprintWidth,
      footprintHeight: placement.footprintHeight,
      rotationStep,
      placementBaseLocalY: placementBaseLocalY ?? undefined,
    });
  }

  function onToolChanged() {
    clear();
    sync(lastFocused ?? getFocusedObject());
  }

  /**
   * R key — rotate the visible ghost (90° steps). No-op when ghost is not shown.
   * @returns {boolean} true if a ghost was rotated
   */
  function rotateGhostStep() {
    const toolId = getActiveToolId();
    if (!isPlaceableTool(toolId)) {
      return false;
    }

    const ghostController = getGhost();
    if (!ghostController?.active) {
      return false;
    }

    ghostController.rotateStep();
    sync(lastFocused ?? getFocusedObject());
    return true;
  }

  return {
    sync,
    clear,
    suppressGhostAtFootprint,
    onToolChanged,
    rotateGhostStep,
  };
}
