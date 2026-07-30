import { assertBuildingInstanceId } from '../../../../shared/building-identity/BuildingInstanceId.js';

/**
 * Événement de domaine : l'accès routier d'un bâtiment a changé.
 *
 * @param {object} params
 * @param {string} params.instanceId
 * @param {number} params.previousRoadCount
 * @param {Readonly<{ roadCount: number, hasAccess: boolean }>} params.newRoadAccess
 */
export function createRoadAccessChanged({
  instanceId,
  previousRoadCount,
  newRoadAccess,
}) {
  return Object.freeze({
    type: 'parcels.RoadAccessChanged',
    instanceId: assertBuildingInstanceId(instanceId),
    previousRoadCount,
    newRoadCount: newRoadAccess.roadCount,
    hasAccess: newRoadAccess.hasAccess,
    occurredAt: Date.now(),
  });
}
