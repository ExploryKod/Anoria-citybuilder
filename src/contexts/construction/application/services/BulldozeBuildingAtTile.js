import {
  clearBuildingFootprint,
  resolveGridSize,
} from '../../domain/policies/FootprintAvailabilityPolicy.js';

/**
 * Clear city footprint + delete Dexie row (via Parcels sync) so scene.update cannot resurrect the mesh.
 */
export class BulldozeBuildingAtTile {
  /**
   * @param {object} deps
   * @param {(params: { instanceId: string }) => Promise<unknown>} deps.syncRemovedBuilding
   * @param {Record<string, { gridSize?: number }>} deps.assetCatalog
   */
  constructor({ syncRemovedBuilding, assetCatalog }) {
    this.syncRemovedBuilding = syncRemovedBuilding;
    this.assetCatalog = assetCatalog;
  }

  /**
   * @param {object} params
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {number} params.x
   * @param {number} params.y
   * @param {string | null} [params.meshInstanceId]
   * @returns {Promise<{ buildingId: string | undefined, removedInstanceId: string | null, gridSize: number }>}
   */
  async execute({ city, x, y, meshInstanceId = null }) {
    const tile = city.tiles?.[x]?.[y];
    const buildingId = tile?.buildingId;
    const removedInstanceId = tile?.instanceId ?? meshInstanceId ?? null;
    const gridSize = resolveGridSize(this.assetCatalog, buildingId);

    clearBuildingFootprint(city, x, y, gridSize);

    if (removedInstanceId) {
      try {
        await this.syncRemovedBuilding({ instanceId: removedInstanceId });
      } catch (err) {
        console.warn('[Construction] Bulldoze Dexie remove failed:', removedInstanceId, err);
      }
    }

    return { buildingId, removedInstanceId, gridSize };
  }
}
