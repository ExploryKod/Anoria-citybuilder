import { TEST_HAMLET_ID } from '../helpers/testHamlet.js';
import {
  createBuildingInstanceId,
  canonicalizeHouseRecord,
} from '../../src/shared/building-identity/index.js';

/**
 * Build a canonical Dexie row for tests.
 *
 * @param {object} params
 * @param {string} params.type
 * @param {number} params.x
 * @param {number} params.y
 * @param {string} [params.instanceId]
 * @param {Record<string, unknown>} [params.extra]
 */
export function makeHouseRecord({ type, x, y, instanceId, extra = {} }) {
  return canonicalizeHouseRecord({
    hamletId: TEST_HAMLET_ID,
    instanceId: instanceId ?? createBuildingInstanceId(),
    type,
    x,
    y,
    price: 10,
    pop: 0,
    neighbors: [],
    stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
    roads: 0,
    worldTime: 0,
    ...extra,
  });
}

export { createBuildingInstanceId };
