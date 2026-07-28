import { needsRoadAccess } from '../../domain/policies/BuildingTypePolicy.js';
import { evaluateRoadAccess } from '../../domain/policies/RoadAccessPolicy.js';
import { createRoadAccessChanged } from '../../domain/events/RoadAccessChanged.js';

/**
 * Use case : recalcule l'accès routier d'un bâtiment et persiste si changement.
 */
export class RecalculateRoadAccessForBuilding {
  /**
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} buildingRepository
   * @param {import('../ports/DomainEventPublisher.js').DomainEventPublisher} eventPublisher
   */
  constructor(buildingRepository, eventPublisher) {
    this.buildingRepository = buildingRepository;
    this.eventPublisher = eventPublisher;
  }

  /**
   * @param {string} buildingId
   * @returns {Promise<{ updated: boolean, buildingId: string, roadAccess: import('../../domain/value-objects/RoadAccess.js').ReturnType<import('../../domain/value-objects/RoadAccess.js').createRoadAccess> } | null>}
   */
  async execute(buildingId) {
    const building = await this.buildingRepository.findById(buildingId);
    if (!building) {
      return null;
    }

    if (!needsRoadAccess(building.type)) {
      return {
        updated: false,
        buildingId,
        roadAccess: evaluateRoadAccess([]),
        skipped: true,
      };
    }

    const roadAccess = evaluateRoadAccess(building.neighbors);
    const previousRoadCount = building.roadCount;

    if (roadAccess.roadCount === previousRoadCount) {
      return { updated: false, buildingId, roadAccess };
    }

    await this.buildingRepository.saveRoadAccess(buildingId, roadAccess.roadCount);

    this.eventPublisher.publish(
      createRoadAccessChanged({
        buildingId,
        previousRoadCount,
        newRoadAccess: roadAccess,
      })
    );

    return { updated: true, buildingId, roadAccess };
  }
}
