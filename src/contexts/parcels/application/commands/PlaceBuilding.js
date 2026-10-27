/**
 * Après placement (ligne déjà en base) : l'accès routier de la ville est recalculé (une pose peut en donner à d'autres bâtiments, si c'est une route, ou en avoir besoin).
 * Paiement / tuiles / meshes restent hors Parcels.
 */
export class PlaceBuilding {
  /**
   * @param {object} deps
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} deps.buildingRepository
   * @param {import('./RecalculateAllRoadAccess.js').RecalculateAllRoadAccess} deps.recalculateAllRoadAccess
   */
  constructor({ buildingRepository, recalculateAllRoadAccess }) {
    this.buildingRepository = buildingRepository;
    this.recalculateAllRoadAccess = recalculateAllRoadAccess;
  }

  /**
   * @param {{ instanceId: string }} params
   * @returns {Promise<{ instanceId: string } | null>} null when the building is not in the repository
   */
  async execute({ instanceId }) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    await this.recalculateAllRoadAccess.execute();

    return { instanceId };
  }
}
