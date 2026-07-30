import { normalizeNeighborList } from '../../domain/policies/NeighborListPolicy.js';

/**
 * Retrait d'un bâtiment : delete repo, rafraîchir voisins des adjacents, accès routier ciblé.
 * Meshes / city.tiles restent hors Parcels.
 */
export class RemoveBuilding {
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
   * @param {{ instanceId: string, zones?: number[] }} params
   * @returns {Promise<{ instanceId: string, affectedIds: string[], deleted: boolean } | null>}
   */
  async execute({ instanceId, zones = [1, 2] }) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    const formerNeighbors = normalizeNeighborList(
      await this.buildingRepository.findNeighbors(instanceId)
    );
    const affected = new Set(
      formerNeighbors.map((n) => n.instanceId).filter(Boolean)
    );

    await this.buildingRepository.deleteById(instanceId);

    for (const adjId of [...affected]) {
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
      deleted: true,
    };
  }
}
