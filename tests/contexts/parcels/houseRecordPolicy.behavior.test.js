/**
 * Behavior tests — canonical Dexie building records (BC Parcels)
 */

import { describe, test, expect } from '@jest/globals';
import {
  canonicalizeHouseRecord,
  createBuildingInstanceId,
  instanceIdFromHouseRow,
  residentialTierPatch,
} from '../../../src/shared/building-identity/index.js';

describe('HouseRecordPolicy — canonicalizeHouseRecord', () => {
  test('sets instanceId as stable PK on placement row', () => {
    const instanceId = createBuildingInstanceId();
    const row = canonicalizeHouseRecord({
      instanceId,
      type: 'House-Blue',
      x: 3,
      y: 7,
      pop: 0,
    });

    expect(row.instanceId).toBe(instanceId);
    expect(row.id).toBe(instanceId);
    expect(row.type).toBe('House-Blue');
    expect(row.x).toBe(3);
    expect(row.y).toBe(7);
  });

  test('evolution patch updates type/tier without changing instanceId', () => {
    const instanceId = createBuildingInstanceId();
    const row = canonicalizeHouseRecord({
      instanceId,
      type: 'House-Blue',
      x: 3,
      y: 7,
      pop: 7,
    });

    const patch = residentialTierPatch({
      instanceId,
      targetType: 'House-Red',
    });

    const evolved = canonicalizeHouseRecord({
      ...row,
      ...patch,
    });

    expect(instanceIdFromHouseRow(evolved)).toBe(instanceId);
    expect(evolved.type).toBe('House-Red');
    expect(evolved.tier).toBe(2);
  });

  test('rejects row without UUID instanceId', () => {
    expect(() =>
      canonicalizeHouseRecord({
        name: 'Farm-Wheat-5-5',
        type: 'Farm-Wheat',
        x: 5,
        y: 5,
      })
    ).toThrow(/instanceId/);
  });
});
