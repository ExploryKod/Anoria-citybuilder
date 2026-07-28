import { needsRoadAccess } from '../../domain/policies/BuildingTypePolicy.js';
import { evaluateRoadAccess } from '../../domain/policies/RoadAccessPolicy.js';
import { createRoadAccessChanged } from '../../domain/events/RoadAccessChanged.js';

/**
 * Use case : recalcule l'accès routier de tous les bâtiments concernés.
 */
export class RecalculateAllRoadAccess {
  /**
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} buildingRepository
   * @param {import('../ports/DomainEventPublisher.js').DomainEventPublisher} eventPublisher
   */
  constructor(buildingRepository, eventPublisher) {
    this.buildingRepository = buildingRepository;
    this.eventPublisher = eventPublisher;
  }

  /**
   * @returns {Promise<{ processed: number, updated: number, results: Array<{ buildingId: string, updated: boolean }> }>}
   */
  async execute() {
    const buildings = await this.buildingRepository.findAll();
    const results = [];
    let updated = 0;

    for (const building of buildings) {
      if (!needsRoadAccess(building.type)) {
        continue;
      }

      const roadAccess = evaluateRoadAccess(building.neighbors);
      const previousRoadCount = building.roadCount;
      const hasChanged = roadAccess.roadCount !== previousRoadCount;

      if (hasChanged) {
        await this.buildingRepository.saveRoadAccess(building.id, roadAccess.roadCount);
        this.eventPublisher.publish(
          createRoadAccessChanged({
            buildingId: building.id,
            previousRoadCount,
            newRoadAccess: roadAccess,
          })
        );
        updated += 1;
      }

      results.push({ buildingId: building.id, updated: hasChanged });
    }

    return {
      processed: results.length,
      updated,
      results,
    };
  }
}
