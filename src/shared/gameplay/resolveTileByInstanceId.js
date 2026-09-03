/**
 * Finds the grid tile currently holding a given building instance.
 *
 * Domain events carry building instance ids (Dexie row ids), not grid
 * positions — bounded contexts like Supply have no notion of the render
 * grid, correctly. Resolving "where is this instance right now" is a
 * presentation/spatial concern, so it lives here rather than on the event
 * itself. Same scan shape as parcels' `findFootprintAnchor`.
 *
 * @param {{ size: number, tiles: Array<Array<{ instanceId?: string }>> }} city
 * @param {string | null | undefined} instanceId
 * @returns {{ x: number, y: number } | null}
 */
export function resolveTileByInstanceId(city, instanceId) {
  if (!instanceId || !city?.tiles) return null;

  const size = city.size ?? 0;
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      if (city.tiles[x]?.[y]?.instanceId === instanceId) {
        return { x, y };
      }
    }
  }
  return null;
}
