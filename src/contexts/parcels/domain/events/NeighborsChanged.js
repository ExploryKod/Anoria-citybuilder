/**
 * Événement de domaine : la liste des voisins d'un bâtiment a été mise à jour.
 * `buildingId` = Published Language (string).
 */
import { toPublishedBuildingId } from '../value-objects/BuildingId.js';

export function createNeighborsChanged({ buildingId, neighborCount, previousCount }) {
  return Object.freeze({
    type: 'parcels.NeighborsChanged',
    buildingId: toPublishedBuildingId(buildingId),
    neighborCount,
    previousCount,
    occurredAt: Date.now(),
  });
}
