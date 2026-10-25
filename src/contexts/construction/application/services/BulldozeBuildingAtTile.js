import {
  clearBuildingFootprint,
  findFootprintAnchor,
  resolveGridSize,
} from '../../domain/policies/FootprintAvailabilityPolicy.js';
import { isUndemolishable } from '../../../../shared/building-catalog/buildingCatalog.js';

/**
 * Close the building's books (a demolition is a liquidation), then clear city footprint + delete Dexie row (via Parcels sync) so scene.update cannot resurrect the mesh.
 * A building the catalog says cannot be demolished is refused before anything is touched.
 */
export class BulldozeBuildingAtTile {
  /**
   * @param {object} deps
   * @param {(params: { instanceId: string }) => Promise<unknown>} deps.syncRemovedBuilding
   * @param {(params: { instanceId: string, buildingType: string }) => Promise<unknown>} deps.liquidateBuilding closes the accounts of the building that leaves; its failure stops the demolition
   * @param {Record<string, { gridSize?: number }>} deps.assetCatalog
   */
  constructor({ syncRemovedBuilding, liquidateBuilding, assetCatalog }) {
    if (typeof liquidateBuilding !== 'function') {
      throw new Error('[construction] BulldozeBuildingAtTile needs liquidateBuilding: a demolition that does not close the accounts of what it removes leaves the books broken');
    }
    this.syncRemovedBuilding = syncRemovedBuilding;
    this.liquidateBuilding = liquidateBuilding;
    this.assetCatalog = assetCatalog;
  }

  /**
   * @param {object} params
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {number} params.x
   * @param {number} params.y
   * @param {string | null} [params.meshInstanceId]
   * @returns {Promise<{ buildingId: string | undefined, removedInstanceId: string | null, gridSize: number, refused?: 'building_undemolishable' }>}
   *   `refused` is set, and nothing is removed, when the catalog forbids demolishing that building
   */
  async execute({ city, x, y, meshInstanceId = null }) {
    const tile = city.tiles?.[x]?.[y];
    const buildingId = tile?.buildingId;
    const removedInstanceId = tile?.instanceId ?? meshInstanceId ?? null;
    const gridSize = resolveGridSize(this.assetCatalog, buildingId);

    if (isUndemolishable(buildingId)) {
      return { buildingId, removedInstanceId: null, gridSize, refused: 'building_undemolishable' };
    }

    const anchor = findFootprintAnchor(city, x, y, removedInstanceId);

    // The books first: if they cannot be closed, the building stays and the error is shown, instead of a city whose accounts point at something gone.
    if (removedInstanceId) {
      await this.liquidateBuilding({ instanceId: removedInstanceId, buildingType: buildingId });
    }

    clearBuildingFootprint(city, anchor.x, anchor.y, gridSize);

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
