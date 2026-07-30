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
   * @param {string} instanceId
   * @returns {Promise<{ updated: boolean, instanceId: string, roadAccess: import('../../domain/value-objects/RoadAccess.js').ReturnType<import('../../domain/value-objects/RoadAccess.js').createRoadAccess> } | null>}
   */
  async execute(instanceId) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    if (!needsRoadAccess(building.type)) {
      return {
        updated: false,
        instanceId,
        roadAccess: evaluateRoadAccess([]),
        skipped: true,
      };
    }

    const roadAccess = evaluateRoadAccess(building.neighbors);
    const previousRoadCount = building.roadCount;

    if (roadAccess.roadCount === previousRoadCount) {
      return { updated: false, instanceId, roadAccess };
    }

    await this.buildingRepository.saveRoadAccess(building.id, roadAccess.roadCount);

    this.eventPublisher.publish(
      createRoadAccessChanged({
        instanceId: building.id,
        previousRoadCount,
        newRoadAccess: roadAccess,
      })
    );

    return { updated: true, instanceId, roadAccess };
  }
}
