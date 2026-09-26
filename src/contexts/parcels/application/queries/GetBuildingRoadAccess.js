import { needsRoadAccess, withRoadNeed } from '../../domain/policies/BuildingTypePolicy.js';
import { evaluateRoadAccess, evaluateRoadAccessByRange } from '../../domain/policies/RoadAccessPolicy.js';

/**
 * Query : lit l'accès routier d'un bâtiment (routes à portée de Manhattan de son empreinte).
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
      roadAccess: withRoadNeed(
        building.type,
        evaluateRoadAccessByRange(building, await this.buildingRepository.findRoadTiles())
      ),
      applicable: true,
    };
  }
}
