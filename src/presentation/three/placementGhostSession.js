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

  function clear() {
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
      return;
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
    onToolChanged,
  };
}
