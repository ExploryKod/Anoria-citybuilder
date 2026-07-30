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
   * @param {string} instanceId
   * @returns {Promise<{ instanceId: string, type: string, roadAccess: Readonly<{ roadCount: number, hasAccess: boolean }> } | null>}
   */
  async execute(instanceId) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    if (!needsRoadAccess(building.type)) {
      return {
        instanceId,
        type: building.type,
        roadAccess: evaluateRoadAccess([]),
        applicable: false,
      };
    }

    return {
      instanceId,
      type: building.type,
      roadAccess: evaluateRoadAccess(building.neighbors),
      applicable: true,
    };
  }
}
