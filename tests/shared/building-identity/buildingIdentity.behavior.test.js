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
  resolveBuildingInstanceIdFromRef,
  resolveInstanceIdFromNeighborRef,
  displayLabelFromHouseRow,
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

    test('resolveBuildingInstanceIdFromRef accepts UUID string or row', () => {
      const record = makeHouseRecord({ type: 'House-Blue', x: 1, y: 2 });
      expect(resolveBuildingInstanceIdFromRef(record.instanceId)).toBe(record.instanceId);
      expect(resolveBuildingInstanceIdFromRef(record)).toBe(record.instanceId);
    });

    test('resolveInstanceIdFromNeighborRef accepts UUID on neighbor blobs', () => {
      const instanceId = createBuildingInstanceId();
      expect(resolveInstanceIdFromNeighborRef({ instanceId })).toBe(instanceId);
      expect(resolveInstanceIdFromNeighborRef({ id: instanceId, type: 'Farm-Wheat', x: 2, y: 3 })).toBe(
        instanceId
      );
    });

    test('resolveInstanceIdFromNeighborRef rejects type-x-y labels', () => {
      expect(resolveInstanceIdFromNeighborRef({ id: 'House-Blue-1-2', type: 'House-Blue', x: 1, y: 2 })).toBeNull();
    });
  });
});
