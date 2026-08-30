import { describe, expect, test } from '@jest/globals';
import { resolveBeachBorderCompass } from '../../../src/shared/terrain-catalog/beachBorderCompass.js';
import { buildIslandBeachBorderLayout } from '../../../src/shared/terrain-catalog/buildIslandBeachBorderLayout.js';

describe('buildIslandBeachBorderLayout', () => {
  test('builds an organic shore around a 4x4 playable area', () => {
    const tiles = buildIslandBeachBorderLayout(4, { padding: 4, seed: 42 });
    expect(tiles.length).toBeGreaterThan(20);

    const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));
    expect(keys.has('1,1')).toBe(false);
    expect([...keys].some((key) => key.startsWith('-'))).toBe(true);
  });

  test('corners use diagonal compass variants', () => {
    expect(resolveBeachBorderCompass(-1, -1, 16)).toBe('SW');
    expect(resolveBeachBorderCompass(16, -1, 16)).toBe('SE');
    expect(resolveBeachBorderCompass(-1, 16, 16)).toBe('NW');
    expect(resolveBeachBorderCompass(16, 16, 16)).toBe('NE');
  });

  test('edges face outward from the island', () => {
    expect(resolveBeachBorderCompass(-1, 8, 16)).toBe('NW');
    expect(resolveBeachBorderCompass(16, 8, 16)).toBe('SE');
    expect(resolveBeachBorderCompass(8, -1, 16)).toBe('SW');
    expect(resolveBeachBorderCompass(8, 16, 16)).toBe('NE');
  });
});
