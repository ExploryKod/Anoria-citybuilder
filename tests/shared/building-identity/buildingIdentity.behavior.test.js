/**
 * Shared Kernel — building identity (source of truth)
 */

import { describe, test, expect } from '@jest/globals';
import {
  createBuildingId,
  toBuildingIdString,
  toDisplayLabel,
  createBuildingInstanceId,
  isBuildingInstanceId,
  instanceIdFromHouseRow,
  canonicalizeHouseRecord,
} from '../../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';

describe('Shared Kernel — building identity', () => {
  describe('BuildingId (display)', () => {
    test('display label is type-x-y', () => {
      expect(createBuildingId('House-Blue', 3, 7).value).toBe('House-Blue-3-7');
      expect(toBuildingIdString('Farm-Wheat', 5, 3)).toBe('Farm-Wheat-5-3');
      expect(toDisplayLabel('House-Blue', 1, 1)).toBe('House-Blue-1-1');
    });
  });

  describe('BuildingInstanceId', () => {
    test('createBuildingInstanceId returns valid UUID v4', () => {
      const id = createBuildingInstanceId();
      expect(isBuildingInstanceId(id)).toBe(true);
    });
  });

  describe('BuildingRecord', () => {
    test('canonicalizeHouseRecord requires UUID instanceId and footprint', () => {
      const instanceId = createBuildingInstanceId();
      const row = canonicalizeHouseRecord({
        instanceId,
        type: 'House-2Story',
        x: 3,
        y: 7,
        pop: 7,
      });

      expect(row.instanceId).toBe(instanceId);
      expect(row.id).toBe(instanceId);
      expect(row.type).toBe('House-2Story');
      expect(row.x).toBe(3);
      expect(row.y).toBe(7);
      expect(row.anchorX).toBe(3);
      expect(row.anchorY).toBe(7);
    });

    test('instanceIdFromHouseRow reads canonical row', () => {
      const record = makeHouseRecord({ type: 'Market-Stall', x: 4, y: 5 });
      expect(instanceIdFromHouseRow(record)).toBe(record.instanceId);
    });
  });
});
