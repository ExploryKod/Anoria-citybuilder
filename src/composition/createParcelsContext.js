import { DexieBuildingRepository } from '../contexts/parcels/infrastructure/dexie/DexieBuildingRepository.js';
import { InMemoryDomainEventPublisher } from '../contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { SceneSpatialNeighborhoodAdapter } from '../contexts/parcels/infrastructure/spatial/SceneSpatialNeighborhoodAdapter.js';
import { RecalculateRoadAccessForBuilding } from '../contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateAllRoadAccess } from '../contexts/parcels/application/commands/RecalculateAllRoadAccess.js';
import { RecalculateRoadAccessForNeighbors } from '../contexts/parcels/application/commands/RecalculateRoadAccessForNeighbors.js';
import { UpdateNeighborsForBuilding } from '../contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { PlaceBuilding } from '../contexts/parcels/application/commands/PlaceBuilding.js';
import { RemoveBuilding } from '../contexts/parcels/application/commands/RemoveBuilding.js';
import { GetBuildingRoadAccess } from '../contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { GetBuildingNeighbors } from '../contexts/parcels/application/queries/GetBuildingNeighbors.js';

/**
 * Composition root du bounded context Parcels.
 *
 * @param {object} [deps]
 * @param {import('../contexts/parcels/application/ports/BuildingRepository.js').BuildingRepository} [deps.buildingRepository]
 * @param {import('../contexts/parcels/application/ports/DomainEventPublisher.js').DomainEventPublisher} [deps.eventPublisher]
 * @param {import('../contexts/parcels/application/ports/SpatialNeighborhoodPort.js').SpatialNeighborhoodPort} [deps.spatialNeighborhood]
 */
export function createParcelsContext({
  buildingRepository,
  eventPublisher,
  spatialNeighborhood,
} = {}) {
  const buildingRepositoryImpl =
    buildingRepository ?? new DexieBuildingRepository();
  const events = eventPublisher ?? new InMemoryDomainEventPublisher();
  const spatial = spatialNeighborhood ?? new SceneSpatialNeighborhoodAdapter();

  const recalculateRoadAccessForBuilding = new RecalculateRoadAccessForBuilding(
    buildingRepositoryImpl,
    events
  );
  const recalculateAllRoadAccess = new RecalculateAllRoadAccess(
    buildingRepositoryImpl,
    events
  );
  const recalculateRoadAccessForNeighbors = new RecalculateRoadAccessForNeighbors(
    recalculateRoadAccessForBuilding
  );
  const updateNeighborsForBuilding = new UpdateNeighborsForBuilding(
    buildingRepositoryImpl,
    events
  );
  const placeBuilding = new PlaceBuilding({
    buildingRepository: buildingRepositoryImpl,
    spatialNeighborhood: spatial,
    updateNeighborsForBuilding,
    recalculateRoadAccessForNeighbors,
  });
  const removeBuilding = new RemoveBuilding({
    buildingRepository: buildingRepositoryImpl,
    spatialNeighborhood: spatial,
    updateNeighborsForBuilding,
    recalculateRoadAccessForNeighbors,
  });
  const getBuildingRoadAccess = new GetBuildingRoadAccess(buildingRepositoryImpl);
  const getBuildingNeighbors = new GetBuildingNeighbors(buildingRepositoryImpl);

  return {
    buildingRepository: buildingRepositoryImpl,
    eventPublisher: events,
    spatialNeighborhood: spatial,
    recalculateRoadAccessForBuilding,
    recalculateAllRoadAccess,
    recalculateRoadAccessForNeighbors,
    updateNeighborsForBuilding,
    placeBuilding,
    removeBuilding,
    getBuildingRoadAccess,
    getBuildingNeighbors,

    /** Bind grille scène pour le port spatial (chaque scene.update) */
    bindSpatialContext(ctx) {
      if (typeof spatial.bind === 'function') {
        spatial.bind(ctx);
      }
    },

    /** Query UI : accès routier */
    async getRoadAccess(instanceId) {
      const result = await getBuildingRoadAccess.execute(instanceId);
      return result?.roadAccess ?? { roadCount: 0, hasAccess: false };
    },

    /** Query UI : voisins (read model plat) */
    async getNeighbors(instanceId) {
      const result = await getBuildingNeighbors.execute(instanceId);
      return result?.neighbors ?? [];
    },

    /** Command : persister les voisins (liste déjà calculée côté grille) */
    async updateNeighbors(instanceId, neighbors) {
      return updateNeighborsForBuilding.execute(instanceId, neighbors);
    },

    /** Command : sync voisins + road access après placement (DB déjà créée) */
    async syncPlacedBuilding(params) {
      return placeBuilding.execute(params);
    },

    /** Command : delete + refresh adjacents + road access */
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
