/** @typedef {import('../../domain/EditorMapLayout.js').EditorMapLayout} EditorMapLayout */
/** @typedef {import('../ports/EditorStackLayoutPort.js').EditorStackLayoutPort} EditorStackLayoutPort */

/**
 * @param {{ size: number, tiles: object[][] }} city
 * @param {EditorMapLayout} layout
 * @param {EditorStackLayoutPort} stackPort
 */
export function applyEditorMapLayoutToCity(city, layout, stackPort) {
  if (city.size !== layout.citySize) {
    throw new Error(
      `City size ${city.size} does not match layout citySize ${layout.citySize}`
    );
  }

  for (let x = 0; x < layout.citySize; x += 1) {
    for (let y = 0; y < layout.citySize; y += 1) {
      const tile = city.tiles[x]?.[y];
      if (!tile) {
        throw new Error(`City tile missing at ${x},${y}`);
      }
      tile.terrainId = layout.terrain[x][y];
      tile.buildingId = undefined;
      tile.instanceId = undefined;
      tile.buildingCoord = undefined;
      delete tile.placementRotationStep;
    }
  }

  stackPort.resetStackObjects();
  stackPort.importStackObjects(layout.stackObjects);
}
