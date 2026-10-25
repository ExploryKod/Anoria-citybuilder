/**
 * Retrait d'un bâtiment : comptes clos, delete repo, puis accès routier de la ville recalculé (une route retirée en prive d'autres de leur accès).
 * Meshes / city.tiles restent hors Parcels.
 */
export class RemoveBuilding {
  /**
   * @param {object} deps
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} deps.buildingRepository
   * @param {import('./RecalculateAllRoadAccess.js').RecalculateAllRoadAccess} deps.recalculateAllRoadAccess
   * @param {(params: { instanceId: string, buildingType: string }) => Promise<unknown>} deps.liquidateBuilding closes the accounts of the building that leaves. Every
   *   way a building leaves the map ends here (the eraser, a disaster, a hub that takes its dependents down), so none can leave debts pointing at what is gone.
   */
  constructor({ buildingRepository, recalculateAllRoadAccess, liquidateBuilding }) {
    if (typeof liquidateBuilding !== 'function') {
      throw new Error('[parcels] RemoveBuilding needs liquidateBuilding: a building that leaves the map without its accounts closed leaves the monthly settlement to fail');
    }
    this.liquidateBuilding = liquidateBuilding;
    this.buildingRepository = buildingRepository;
    this.recalculateAllRoadAccess = recalculateAllRoadAccess;
  }

  /**
   * @param {{ instanceId: string }} params
   * @returns {Promise<{ instanceId: string, deleted: boolean } | null>} null when the building is not in the repository
   */
  async execute({ instanceId }) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    // The books first: if they cannot be closed, the building is not removed (see BulldozeBuildingAtTile, which closes them earlier for the player's own demolition: idempotent).
    await this.liquidateBuilding({ instanceId, buildingType: building.type });
    await this.buildingRepository.deleteById(instanceId);

    await this.recalculateAllRoadAccess.execute();

    return { instanceId, deleted: true };
  }
}
