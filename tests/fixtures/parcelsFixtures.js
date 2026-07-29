import { createBuildingInstanceId } from '../../src/shared/building-identity/index.js';
import { createBuildingSnapshot } from '../../src/contexts/parcels/domain/BuildingSnapshot.js';

/**
 * Voisin scan / Dexie blob for tests (UUID required).
 */
export function makeNeighborRef({
  type,
  x,
  y,
  instanceId = createBuildingInstanceId(),
  isRoad = false,
  zone = 1,
  userData,
} = {}) {
  return {
    instanceId,
    id: instanceId,
    type,
    x,
    y,
    zone,
    isRoad,
    ...(userData ? { userData } : {}),
  };
}

export function makeRoadNeighborRef(x = 0, y = 1, instanceId = createBuildingInstanceId()) {
  return makeNeighborRef({ type: 'roads', x, y, instanceId, isRoad: true });
}

/**
 * Parcels BuildingSnapshot for in-memory repos (UUID PK).
 */
export function makeParcelHouseSnapshot({
  instanceId = createBuildingInstanceId(),
  type = 'House-Blue',
  x = 3,
  y = 7,
  neighbors = [],
  roadCount = 0,
} = {}) {
  return createBuildingSnapshot({
    id: instanceId,
    type,
    x,
    y,
    neighbors,
    roadCount,
  });
}

export { createBuildingInstanceId };
