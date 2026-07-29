/**
 * Behavior tests — canonical HousesStore records (BC Parcels)
 */

import { describe, test, expect } from '@jest/globals';
import { canonicalizeHouseRecord } from '../../../src/contexts/parcels/domain/policies/HouseRecordPolicy.js';

describe('HouseRecordPolicy — canonicalizeHouseRecord', () => {
  test('sets id and name to published id on placement row', () => {
    const row = canonicalizeHouseRecord({
      name: 'House-Blue-3-7',
      type: 'House-Blue',
      x: 3,
      y: 7,
      pop: 0,
    });

    expect(row.id).toBe('House-Blue-3-7');
    expect(row.name).toBe('House-Blue-3-7');
    expect(row.type).toBe('House-Blue');
    expect(row.x).toBe(3);
    expect(row.y).toBe(7);
  });

  test('syncs id on evolution rename (type changes, tile unchanged)', () => {
    const row = canonicalizeHouseRecord({
      name: 'House-2Story-3-7',
      type: 'House-2Story',
      x: 3,
      y: 7,
      pop: 7,
    });

    expect(row.id).toBe('House-2Story-3-7');
    expect(row.name).toBe('House-2Story-3-7');
  });

  test('repairs missing id on legacy row that only had name', () => {
    const row = canonicalizeHouseRecord({
      name: 'Farm-Wheat-5-5',
      type: 'Farm-Wheat',
      x: 5,
      y: 5,
    });

    expect(row.id).toBe('Farm-Wheat-5-5');
    expect(row.name).toBe('Farm-Wheat-5-5');
  });
});
