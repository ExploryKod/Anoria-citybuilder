import { DexieBuildingRepository } from '../contexts/parcels/infrastructure/dexie/DexieBuildingRepository.js';
import { InMemoryDomainEventPublisher } from '../contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { RecalculateRoadAccessForBuilding } from '../contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateAllRoadAccess } from '../contexts/parcels/application/commands/RecalculateAllRoadAccess.js';
import { PlaceBuilding } from '../contexts/parcels/application/commands/PlaceBuilding.js';
import { RemoveBuilding } from '../contexts/parcels/application/commands/RemoveBuilding.js';
import { GetBuildingRoadAccess } from '../contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { liquidateDemolishedBuilding } from './constructionTreasuryBridge.js';

/**
 * Composition root du bounded context Parcels.
 *
 * @param {object} [deps]
 * @param {import('../contexts/parcels/application/ports/BuildingRepository.js').BuildingRepository} [deps.buildingRepository]
 * @param {import('../contexts/parcels/application/ports/DomainEventPublisher.js').DomainEventPublisher} [deps.eventPublisher]
 * @param {(params: { instanceId: string, buildingType: string }) => Promise<unknown>} [deps.liquidateBuilding] closes the accounts of a building that leaves the map (default: the accounting's)
 */
export function createParcelsContext({
  buildingRepository,
  eventPublisher,
  liquidateBuilding,
} = {}) {
  const buildingRepositoryImpl =
    buildingRepository ?? new DexieBuildingRepository();
  const events = eventPublisher ?? new InMemoryDomainEventPublisher();

  const recalculateRoadAccessForBuilding = new RecalculateRoadAccessForBuilding(
    buildingRepositoryImpl,
    events
  );
  const recalculateAllRoadAccess = new RecalculateAllRoadAccess(
    buildingRepositoryImpl,
    events
  );
  const placeBuilding = new PlaceBuilding({
    buildingRepository: buildingRepositoryImpl,
    recalculateAllRoadAccess,
  });
  const removeBuilding = new RemoveBuilding({
    buildingRepository: buildingRepositoryImpl,
    recalculateAllRoadAccess,
    liquidateBuilding: liquidateBuilding ?? liquidateDemolishedBuilding,
  });
  const getBuildingRoadAccess = new GetBuildingRoadAccess(buildingRepositoryImpl);

  return {
    buildingRepository: buildingRepositoryImpl,
    eventPublisher: events,
    recalculateRoadAccessForBuilding,
    recalculateAllRoadAccess,
    placeBuilding,
    removeBuilding,
    getBuildingRoadAccess,

    /** Query UI : accès routier */
    async getRoadAccess(instanceId) {
      const result = await getBuildingRoadAccess.execute(instanceId);
      return result?.roadAccess ?? { roadCount: 0, hasAccess: false };
    },

    /** Command : accès routier après placement (DB déjà créée) */
    async syncPlacedBuilding(params) {
      return placeBuilding.execute(params);
    },

    /** Command : delete + accès routier */
    async syncRemovedBuilding(params) {
      return removeBuilding.execute(params);
    },
  };
}

/** @type {ReturnType<typeof createParcelsContext> | null} */
let sharedParcels = null;

export function getOrCreateParcelsContext() {
  if (!sharedParcels) {
    sharedParcels = createParcelsContext();
  }
  return sharedParcels;
}

/** @internal Tests uniquement */
export function resetParcelsContextForTests() {
  sharedParcels = null;
}
