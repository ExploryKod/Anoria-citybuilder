import { describe, expect, test } from '@jest/globals';
import { WALKER_ASSETS, WALKER_TYPES } from '../../../src/presentation/three/assets/walkerAssets.js';
import {
  getWalkerAsset,
  pickAppearanceIndex,
  resolveWalkerAppearanceId,
  resolveWalkerClipName,
} from '../../../src/presentation/three/walkers/walkerAppearance.js';
import { WALKER_EVENT_CATALOG } from '../../../src/shared/gameplay/walkerEventCatalog.js';

describe('walker catalog (declarative)', () => {
  test('every appearance a walker type lists is a declared asset', () => {
    for (const [typeId, type] of Object.entries(WALKER_TYPES)) {
      expect(type.appearances.length).toBeGreaterThan(0);
      for (const id of type.appearances) {
        expect(WALKER_ASSETS[id]).toBeDefined();
        expect(WALKER_ASSETS[id].geometry.glb).toMatch(/\.glb$/);
        expect(WALKER_ASSETS[id].animations.idle.length).toBeGreaterThan(0);
        expect(WALKER_ASSETS[id].animations.walk.length).toBeGreaterThan(0);
      }
      expect(typeId).toBeTruthy();
    }
  });

  test('every walkerType a domain event declares exists in WALKER_TYPES', () => {
    for (const [eventType, descriptor] of Object.entries(WALKER_EVENT_CATALOG)) {
      expect(WALKER_TYPES[descriptor.walkerType]).toBeDefined();
      expect(eventType).toBeTruthy();
    }
  });
});

describe('resolveWalkerAppearanceId', () => {
  const pool = WALKER_TYPES.citizen.appearances;

  test("'sequence' walks the pool round-robin, deterministically", () => {
    const picked = pool.concat(pool).map((_, index) => resolveWalkerAppearanceId('citizen', index));
    expect(picked).toEqual([...pool, ...pool]);
  });

  test("'random' picks through the injected RNG, always inside the pool", () => {
    expect(pickAppearanceIndex('random', 3, 0, () => 0)).toBe(0);
    expect(pickAppearanceIndex('random', 3, 0, () => 0.5)).toBe(1);
    expect(pickAppearanceIndex('random', 3, 0, () => 0.999)).toBe(2);
    expect(pickAppearanceIndex('random', 3, 0, () => 1)).toBe(2); // never out of range
  });

  test('an unknown walker type is a loud error, not a silent default', () => {
    expect(() => resolveWalkerAppearanceId('dragon')).toThrow(/Unknown walker type/);
    expect(() => getWalkerAsset('nope')).toThrow(/No walker asset/);
  });
});

describe('resolveWalkerClipName', () => {
  const id = WALKER_TYPES.citizen.appearances[0];

  test('uses the declared clip names', () => {
    expect(resolveWalkerClipName(id, 'idle', ['static', 'idle', 'walk'])).toBe('idle');
    expect(resolveWalkerClipName(id, 'walk', ['static', 'idle', 'walk'])).toBe('walk');
  });

  test('falls back to the first clip for idle and the second for walk', () => {
    expect(resolveWalkerClipName(id, 'idle', ['a', 'b', 'c'])).toBe('a');
    expect(resolveWalkerClipName(id, 'walk', ['a', 'b', 'c'])).toBe('b');
    expect(resolveWalkerClipName(id, 'walk', ['only'])).toBeNull();
    expect(resolveWalkerClipName(id, 'idle', [])).toBeNull();
  });
});
