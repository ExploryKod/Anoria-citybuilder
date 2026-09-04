import { describe, test, expect } from '@jest/globals';
import { meetsTierRequirements } from '../../../src/contexts/housing/domain/policies/HouseTierRequirementPolicy.js';

describe('Housing — HouseTierRequirementPolicy', () => {
  test('an empty requirement list is always met (tier 1 — nothing to require)', () => {
    expect(meetsTierRequirements([], { pop: 0, roadCount: 0 })).toBe(true);
    expect(meetsTierRequirements(undefined, {})).toBe(true);
  });

  test('roadAccess requires at least one road tile', () => {
    expect(meetsTierRequirements([{ kind: 'roadAccess' }], { roadCount: 1 })).toBe(true);
    expect(meetsTierRequirements([{ kind: 'roadAccess' }], { roadCount: 0 })).toBe(false);
  });

  test('population requires at least its declared minimum', () => {
    expect(meetsTierRequirements([{ kind: 'population', min: 2 }], { pop: 2 })).toBe(true);
    expect(meetsTierRequirements([{ kind: 'population', min: 2 }], { pop: 1 })).toBe(false);
  });

  test('every requirement in the list must hold', () => {
    const requirements = [{ kind: 'roadAccess' }, { kind: 'population', min: 1 }];
    expect(meetsTierRequirements(requirements, { roadCount: 1, pop: 1 })).toBe(true);
    expect(meetsTierRequirements(requirements, { roadCount: 0, pop: 1 })).toBe(false);
    expect(meetsTierRequirements(requirements, { roadCount: 1, pop: 0 })).toBe(false);
  });

  test('an unrecognized requirement kind fails closed, not open', () => {
    expect(meetsTierRequirements([{ kind: 'hasChapelNearby' }], { pop: 99, roadCount: 99 })).toBe(false);
  });
});
