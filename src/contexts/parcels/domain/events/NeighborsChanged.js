import { assertBuildingInstanceId } from '../../../../shared/building-identity/BuildingIdentifiers.js';

/**
 * Événement de domaine : la liste des voisins d'un bâtiment a été mise à jour.
 */
export function createNeighborsChanged({ instanceId, neighborCount, previousCount }) {
  return Object.freeze({
    type: 'parcels.NeighborsChanged',
    instanceId: assertBuildingInstanceId(instanceId),
    neighborCount,
    previousCount,
    occurredAt: Date.now(),
  });
}
