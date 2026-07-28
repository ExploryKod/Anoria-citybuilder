import { needsRoadAccess } from '../../domain/policies/BuildingTypePolicy.js';
import { evaluateRoadAccess } from '../../domain/policies/RoadAccessPolicy.js';

/**
 * Query : lit l'accès routier d'un bâtiment (calcul à partir des voisins en base).
 */
export class GetBuildingRoadAccess {
  /**
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} buildingRepository
   */
  constructor(buildingRepository) {
    this.buildingRepository = buildingRepository;
  }

  /**
   * @param {string} buildingId
   * @returns {Promise<{ buildingId: string, type: string, roadAccess: Readonly<{ roadCount: number, hasAccess: boolean }> } | null>}
   */
  async execute(buildingId) {
    const building = await this.buildingRepository.findById(buildingId);
    if (!building) {
      return null;
    }

    if (!needsRoadAccess(building.type)) {
      return {
        buildingId,
        type: building.type,
        roadAccess: evaluateRoadAccess([]),
        applicable: false,
      };
    }

    return {
      buildingId,
      type: building.type,
      roadAccess: evaluateRoadAccess(building.neighbors),
      applicable: true,
    };
  }
}
