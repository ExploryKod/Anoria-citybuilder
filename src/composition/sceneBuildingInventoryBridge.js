/**
 * Cross-context bridge — avoids accounting ↔ construction import cycle at module load.
 * Construction registers listing; accounting reads it at turn-budget time.
 */

/** @type {(() => string[]) | null} */
let listSceneBuildingTypesFn = null;

/** @param {() => string[]} fn */
export function registerSceneBuildingTypeListing(fn) {
  listSceneBuildingTypesFn = fn;
}

/** @internal Tests only */
export function resetSceneBuildingInventoryBridgeForTests() {
  listSceneBuildingTypesFn = null;
}
