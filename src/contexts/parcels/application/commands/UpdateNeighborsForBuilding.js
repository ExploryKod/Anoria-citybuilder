import {
  normalizeNeighborList,
  neighborListsEqual,
  toPersistedNeighborList,
} from '../../domain/policies/NeighborListPolicy.js';
import { createNeighborsChanged } from '../../domain/events/NeighborsChanged.js';

/**
 * Use case : met à jour les voisins d'un bâtiment.
 * Entrée = scan grille legacy ; sortie persistée = forme Parcels sérialisée (sans stocks).
 */
export class UpdateNeighborsForBuilding {
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
   * @param {unknown} neighbors
   * @returns {Promise<{ updated: boolean, instanceId: string, neighborCount: number } | null>}
   */
  async execute(instanceId, neighbors) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    const nextDomain = normalizeNeighborList(neighbors);
    const nextPersisted = toPersistedNeighborList(nextDomain);
    const previousPersisted = toPersistedNeighborList(
      await this.buildingRepository.findNeighbors(building.id)
    );

    if (neighborListsEqual(previousPersisted, nextPersisted)) {
      return {
        updated: false,
        instanceId: building.id,
        neighborCount: nextDomain.length,
      };
    }

    await this.buildingRepository.saveNeighbors(building.id, nextPersisted);

    this.eventPublisher.publish(
      createNeighborsChanged({
        instanceId: building.id,
        neighborCount: nextDomain.length,
        previousCount: previousPersisted.length,
      })
    );

    return {
      updated: true,
      instanceId: building.id,
      neighborCount: nextDomain.length,
    };
  }
}
