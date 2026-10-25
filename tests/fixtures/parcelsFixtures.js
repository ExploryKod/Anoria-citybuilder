import { createBuildingInstanceId } from '../../src/shared/building-identity/index.js';
import { createBuildingSnapshot } from '../../src/contexts/parcels/domain/BuildingSnapshot.js';

/**
 * Parcels BuildingSnapshot for in-memory repos (UUID PK).
 */
export function makeParcelHouseSnapshot({
  instanceId = createBuildingInstanceId(),
  type = 'House-Blue',
  x = 3,
  y = 7,
  roadCount = 0,
} = {}) {
  return createBuildingSnapshot({
    id: instanceId,
    type,
    x,
    y,
    roadCount,
  });
}

export { createBuildingInstanceId };
