import { normalizeNeighborList } from '../../domain/policies/NeighborListPolicy.js';

/**
 * Après placement (ligne déjà en base) : voisins du bâtiment + adjacents, puis accès routier ciblé.
 * Paiement / tuiles / meshes restent hors Parcels.
 */
export class PlaceBuilding {
  /**
   * @param {object} deps
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} deps.buildingRepository
   * @param {import('../ports/SpatialNeighborhoodPort.js').SpatialNeighborhoodPort} deps.spatialNeighborhood
   * @param {import('./UpdateNeighborsForBuilding.js').UpdateNeighborsForBuilding} deps.updateNeighborsForBuilding
   * @param {import('./RecalculateRoadAccessForNeighbors.js').RecalculateRoadAccessForNeighbors} deps.recalculateRoadAccessForNeighbors
   */
  constructor({
    buildingRepository,
    spatialNeighborhood,
    updateNeighborsForBuilding,
    recalculateRoadAccessForNeighbors,
  }) {
    this.buildingRepository = buildingRepository;
    this.spatialNeighborhood = spatialNeighborhood;
    this.updateNeighborsForBuilding = updateNeighborsForBuilding;
    this.recalculateRoadAccessForNeighbors = recalculateRoadAccessForNeighbors;
  }

  /**
   * @param {{ instanceId: string, x: number, y: number, type: string, zones?: number[] }} params
   * @returns {Promise<{ instanceId: string, affectedIds: string[], neighborCount: number } | null>}
   */
  async execute({ instanceId, x, y, type, zones = [1, 2] }) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    const tileX = x ?? building.x;
    const tileY = y ?? building.y;
    const buildingType = type || building.type;

    const rawNeighbors = await this.spatialNeighborhood.discoverInZones({
      x: tileX,
      y: tileY,
      type: buildingType,
      zones,
    });

    await this.updateNeighborsForBuilding.execute(instanceId, rawNeighbors);

    const affected = new Set([instanceId]);
    for (const neighbor of normalizeNeighborList(rawNeighbors)) {
      if (neighbor.instanceId) affected.add(neighbor.instanceId);
    }

    for (const adjId of [...affected]) {
      if (adjId === instanceId) continue;
      const adj = await this.buildingRepository.findById(adjId);
      if (!adj || adj.x == null || adj.y == null) continue;

      const adjNeighbors = await this.spatialNeighborhood.discoverInZones({
        x: adj.x,
        y: adj.y,
        type: adj.type,
        zones,
      });
      await this.updateNeighborsForBuilding.execute(adjId, adjNeighbors);
    }

    await this.recalculateRoadAccessForNeighbors.execute([...affected]);

    return {
      instanceId,
      affectedIds: [...affected],
      neighborCount: normalizeNeighborList(rawNeighbors).length,
    };
  }
}
