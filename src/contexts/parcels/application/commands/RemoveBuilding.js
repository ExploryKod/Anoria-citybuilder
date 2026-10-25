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
   * @param {(params: { instanceId: string, buildingType: string }) => Promise<unknown>} deps.liquidateBuilding closes the accounts of the building that leaves. Every
   *   way a building leaves the map ends here (the eraser, a disaster, a hub that takes its dependents down), so none can leave debts pointing at what is gone.
   */
  constructor({
    buildingRepository,
    spatialNeighborhood,
    updateNeighborsForBuilding,
    recalculateRoadAccessForNeighbors,
    liquidateBuilding,
  }) {
    if (typeof liquidateBuilding !== 'function') {
      throw new Error('[parcels] RemoveBuilding needs liquidateBuilding: a building that leaves the map without its accounts closed leaves the monthly settlement to fail');
    }
    this.liquidateBuilding = liquidateBuilding;
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

    // The books first: if they cannot be closed, the building is not removed (see BulldozeBuildingAtTile, which closes them earlier for the player's own demolition: idempotent).
    await this.liquidateBuilding({ instanceId, buildingType: building.type });
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
