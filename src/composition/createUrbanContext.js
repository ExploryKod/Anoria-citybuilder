import { DexieBuildingRepository } from '../infrastructure/persistence/dexie/DexieBuildingRepository.js';
import { InMemoryDomainEventPublisher } from '../infrastructure/events/InMemoryDomainEventPublisher.js';
import { RecalculateRoadAccessForBuilding } from '../contexts/urban/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateAllRoadAccess } from '../contexts/urban/application/commands/RecalculateAllRoadAccess.js';
import { GetBuildingRoadAccess } from '../contexts/urban/application/queries/GetBuildingRoadAccess.js';

/**
 * Composition root du bounded context Urban.
 *
 * @param {object} deps
 * @param {import('../js/stores/HousesStore.js').default} deps.housesStore - legacy store (ACL)
 * @param {import('../contexts/urban/application/ports/DomainEventPublisher.js').DomainEventPublisher} [deps.eventPublisher]
 */
export function createUrbanContext({ housesStore, eventPublisher }) {
  const buildingRepository = new DexieBuildingRepository(housesStore);
  const events = eventPublisher ?? new InMemoryDomainEventPublisher();

  const recalculateRoadAccessForBuilding = new RecalculateRoadAccessForBuilding(
    buildingRepository,
    events
  );
  const recalculateAllRoadAccess = new RecalculateAllRoadAccess(
    buildingRepository,
    events
  );
  const getBuildingRoadAccess = new GetBuildingRoadAccess(buildingRepository);

  return {
    buildingRepository,
    eventPublisher: events,
    recalculateRoadAccessForBuilding,
    recalculateAllRoadAccess,
    getBuildingRoadAccess,
  };
}
