import { normalizeNeighborList } from '../../domain/policies/NeighborListPolicy.js';

/**
 * Query (CQRS read) : voisins d'un bâtiment pour l'UI / autres BC.
 * Lit via le port BuildingRepository — indépendant de Dexie / Three.js.
 */
export class GetBuildingNeighbors {
  /**
   * @param {import('../ports/BuildingRepository.js').BuildingRepository} buildingRepository
   */
  constructor(buildingRepository) {
    this.buildingRepository = buildingRepository;
  }

  /**
   * @param {string} instanceId
   * @returns {Promise<{
   *   instanceId: string,
   *   neighbors: Array<{
   *     instanceId: string,
   *     type: string,
   *     x: number | null,
   *     y: number | null,
   *     isRoad: boolean,
   *     zone: number | null,
   *   }>,
   * } | null>}
   */
  async execute(instanceId) {
    const building = await this.buildingRepository.findById(instanceId);
    if (!building) {
      return null;
    }

    const raw = await this.buildingRepository.findNeighbors(building.id);
    const neighbors = normalizeNeighborList(raw).map(toNeighborReadModel);

    return {
      instanceId: building.id,
      neighbors,
    };
  }
}

/** Read model plat pour UI (pas de TileCoord imbriqué). */
function toNeighborReadModel(neighbor) {
  return {
    instanceId: neighbor.instanceId,
    type: neighbor.type,
    x: neighbor.tile?.x ?? null,
    y: neighbor.tile?.y ?? null,
    isRoad: neighbor.isRoad,
    zone: neighbor.zone,
  };
}
