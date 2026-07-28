import { DexieBuildingRepository } from '../infrastructure/persistence/dexie/DexieBuildingRepository.js';
import { InMemoryDomainEventPublisher } from '../infrastructure/events/InMemoryDomainEventPublisher.js';
import { SceneSpatialNeighborhoodAdapter } from '../infrastructure/spatial/SceneSpatialNeighborhoodAdapter.js';
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
 * @param {object} deps
 * @param {import('../js/stores/HousesStore.js').default} deps.housesStore - legacy store (ACL)
 * @param {import('../contexts/parcels/application/ports/DomainEventPublisher.js').DomainEventPublisher} [deps.eventPublisher]
 * @param {import('../contexts/parcels/application/ports/SpatialNeighborhoodPort.js').SpatialNeighborhoodPort} [deps.spatialNeighborhood]
 */
export function createParcelsContext({ housesStore, eventPublisher, spatialNeighborhood }) {
  const buildingRepository = new DexieBuildingRepository(housesStore);
  const events = eventPublisher ?? new InMemoryDomainEventPublisher();
  const spatial = spatialNeighborhood ?? new SceneSpatialNeighborhoodAdapter();

  const recalculateRoadAccessForBuilding = new RecalculateRoadAccessForBuilding(
    buildingRepository,
    events
  );
  const recalculateAllRoadAccess = new RecalculateAllRoadAccess(
    buildingRepository,
    events
  );
  const recalculateRoadAccessForNeighbors = new RecalculateRoadAccessForNeighbors(
    recalculateRoadAccessForBuilding
  );
  const updateNeighborsForBuilding = new UpdateNeighborsForBuilding(
    buildingRepository,
    events
  );
  const placeBuilding = new PlaceBuilding({
    buildingRepository,
    spatialNeighborhood: spatial,
    updateNeighborsForBuilding,
    recalculateRoadAccessForNeighbors,
  });
  const removeBuilding = new RemoveBuilding({
    buildingRepository,
    spatialNeighborhood: spatial,
    updateNeighborsForBuilding,
    recalculateRoadAccessForNeighbors,
  });
  const getBuildingRoadAccess = new GetBuildingRoadAccess(buildingRepository);
  const getBuildingNeighbors = new GetBuildingNeighbors(buildingRepository);

  return {
    buildingRepository,
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
    async getRoadAccess(buildingId) {
      const result = await getBuildingRoadAccess.execute(buildingId);
      return result?.roadAccess ?? { roadCount: 0, hasAccess: false };
    },

    /** Query UI : voisins (read model plat) */
    async getNeighbors(buildingId) {
      const result = await getBuildingNeighbors.execute(buildingId);
      return result?.neighbors ?? [];
    },

    /** Command : persister les voisins (liste déjà calculée côté grille) */
    async updateNeighbors(buildingId, neighbors) {
      return updateNeighborsForBuilding.execute(buildingId, neighbors);
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

/** Un seul contexte Parcels par partie (même bus d'événements partout). */
export function getOrCreateParcelsContext(housesStore) {
  if (!sharedParcels) {
    sharedParcels = createParcelsContext({ housesStore });
  }
  return sharedParcels;
}

/** @internal Tests uniquement */
export function resetParcelsContextForTests() {
  sharedParcels = null;
}
