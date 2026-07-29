/**
 * Shared Kernel — building identity (source of truth)
 */

import { describe, test, expect } from '@jest/globals';
import {
  createBuildingId,
  toBuildingIdString,
  resolvePublishedBuildingIdFromRef,
  publishedIdFromHouseRow,
  canonicalizeHouseRecord,
} from '../../../src/shared/building-identity/index.js';

describe('Shared Kernel — building identity', () => {
  describe('BuildingId', () => {
    test('published form is type-x-y', () => {
      expect(createBuildingId('House-Blue', 3, 7).value).toBe('House-Blue-3-7');
      expect(toBuildingIdString('Farm-Wheat', 5, 3)).toBe('Farm-Wheat-5-3');
    });

    test('resolvePublishedBuildingIdFromRef avoids ghost ids', () => {
      expect(
        resolvePublishedBuildingIdFromRef({
          name: 'House-Purple-3-7',
          type: 'House-Purple',
          x: 3,
          y: 7,
        })
      ).toBe('House-Purple-3-7');
    });
  });

  describe('BuildingRecord', () => {
    test('canonicalizeHouseRecord syncs id and name on write', () => {
      const row = canonicalizeHouseRecord({
        name: 'House-2Story-3-7',
        type: 'House-2Story',
        pop: 7,
      });

      expect(row.id).toBe('House-2Story-3-7');
      expect(row.name).toBe('House-2Story-3-7');
      expect(row.x).toBe(3);
      expect(row.y).toBe(7);
    });

    test('publishedIdFromHouseRow reads canonical or legacy row', () => {
      expect(
        publishedIdFromHouseRow({
          id: 'Market-Stall-4-5',
          name: 'Market-Stall-4-5',
          type: 'Market-Stall',
          x: 4,
          y: 5,
        })
      ).toBe('Market-Stall-4-5');

      expect(
        publishedIdFromHouseRow({
          name: 'House-Blue-1-1',
          type: 'House-Blue',
        })
      ).toBe('House-Blue-1-1');
    });
  });
});
