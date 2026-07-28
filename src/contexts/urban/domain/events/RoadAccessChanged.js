/**
 * Événement de domaine : l'accès routier d'un bâtiment a changé.
 */
export function createRoadAccessChanged({
  buildingId,
  previousRoadCount,
  newRoadAccess,
}) {
  return Object.freeze({
    type: 'urban.RoadAccessChanged',
    buildingId,
    previousRoadCount,
    newRoadCount: newRoadAccess.roadCount,
    hasAccess: newRoadAccess.hasAccess,
    occurredAt: Date.now(),
  });
}
