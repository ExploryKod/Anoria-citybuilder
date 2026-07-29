/**
 * System mince : filet desserte routière (BC Parcels).
 * Pas de règle métier ici — délègue au use case.
 *
 * @param {{ recalculateAllRoadAccess: { execute: () => Promise<unknown> } }} parcels
 * @returns {(world: import('../../../../engine/ecs/World.js').World, context?: object) => Promise<void>}
 */
export function createParcelsRoadAccessSystem(parcels) {
  if (!parcels?.recalculateAllRoadAccess?.execute) {
    throw new Error('createParcelsRoadAccessSystem: parcels.recalculateAllRoadAccess required');
  }

  return async function parcelsRoadAccessSystem(_world, _context = {}) {
    await parcels.recalculateAllRoadAccess.execute();
  };
}
