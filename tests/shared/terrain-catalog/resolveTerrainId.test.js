import { describe, expect, test } from '@jest/globals';
import { resolveTerrainId } from '../../../src/shared/terrain-catalog/resolveTerrainId.js';

describe('resolveTerrainId', () => {
  test('maps legacy grass to nature:ground_grass', () => {
    expect(resolveTerrainId('grass')).toBe('nature:ground_grass');
  });

  test('passes through canonical ids', () => {
    expect(resolveTerrainId('nature:ground_grass')).toBe('nature:ground_grass');
  });
});
