import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Remove Dexie rows that no longer match the live city grid (city.tiles is source of truth).
 * Typical case: nature spawn or failed bulldoze left a row while the tile shows empty grass.
 */
export class ReclaimStaleBuildingRecords {
  /**
   * @param {import('../ports/ConstructionBuildingRepository.js').ConstructionBuildingRepository} repository
   */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {object} params
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {number} params.x
   * @param {number} params.y
   * @param {number} [params.gridSize]
   * @returns {Promise<string[]>}
   */
  async execute({ city, x, y, gridSize = 1 }) {
    const reclaimed = [];

    for (let dx = 0; dx < gridSize; dx++) {
      for (let dy = 0; dy < gridSize; dy++) {
        const tileX = x + dx;
        const tileY = y + dy;
        const tile = city.tiles?.[tileX]?.[tileY];

        if (!tile || tile.buildingId || tile.instanceId) {
          continue;
        }

        const atAnchor = await this.repository.findByAnchor(tileX, tileY);
        if (atAnchor) {
          const instanceId = instanceIdFromHouseRow(atAnchor);
          await this.repository.deleteById(instanceId);
          reclaimed.push(instanceId);
          continue;
        }

        const atTile = await this.repository.findAtTile(tileX, tileY);
        if (atTile) {
          const instanceId = instanceIdFromHouseRow(atTile);
          await this.repository.deleteById(instanceId);
          reclaimed.push(instanceId);
        }
      }
    }

    return reclaimed;
  }
}
