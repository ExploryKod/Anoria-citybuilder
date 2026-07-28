import { toPublishedBuildingId } from '../value-objects/BuildingId.js';

/**
 * Événement de domaine : l'accès routier d'un bâtiment a changé.
 * `buildingId` dans le payload = Published Language (string).
 *
 * @param {object} params
 * @param {string | Readonly<{ value: string }>} params.buildingId
 * @param {number} params.previousRoadCount
 * @param {Readonly<{ roadCount: number, hasAccess: boolean }>} params.newRoadAccess
 */
export function createRoadAccessChanged({
  buildingId,
  previousRoadCount,
  newRoadAccess,
}) {
  return Object.freeze({
    type: 'urban.RoadAccessChanged',
    buildingId: toPublishedBuildingId(buildingId),
    previousRoadCount,
    newRoadCount: newRoadAccess.roadCount,
    hasAccess: newRoadAccess.hasAccess,
    occurredAt: Date.now(),
  });
}
