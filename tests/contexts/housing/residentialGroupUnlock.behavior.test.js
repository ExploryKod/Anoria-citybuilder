/**
 * Behavior tests — Housing: tool-panel unlock rule for Blue/Purple houses.
 *
 * Blue (commerçants) and Purple (savants) are disabled at boot; they unlock
 * once enough Red (artisans-ouvriers) houses have reached level 2. See
 * `ResidentialGroupUnlockPolicy` / `ResidentialGroupGating` (presentation).
 */

import { describe, test, expect } from '@jest/globals';
import {
  RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD,
  countRedHousesAtLevel2,
  evaluateResidentialGroupUnlock,
} from '../../../src/contexts/housing/domain/policies/ResidentialGroupUnlockPolicy.js';

describe('Housing — ResidentialGroupUnlockPolicy', () => {
  test('counts only Red houses at level 2', () => {
    const houses = [
      { type: 'House-Red', level: 2 },
      { type: 'House-Red', level: 1 },
      { type: 'House-Blue', level: 2 },
      { type: 'House-Red', level: 2 },
    ];
    expect(countRedHousesAtLevel2(houses)).toBe(2);
  });

  test('stays locked below the threshold', () => {
    const result = evaluateResidentialGroupUnlock([
      { type: 'House-Red', level: 2 },
      { type: 'House-Red', level: 1 },
    ]);
    expect(result.unlocked).toBe(false);
    expect(result.redLevel2Count).toBe(1);
    expect(result.threshold).toBe(RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD);
  });

  test('unlocks once the threshold is reached', () => {
    const houses = Array.from({ length: RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD }, () => ({
      type: 'House-Red',
      level: 2,
    }));
    const result = evaluateResidentialGroupUnlock(houses);
    expect(result.unlocked).toBe(true);
    expect(result.redLevel2Count).toBe(RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD);
  });

  test('no houses stays locked', () => {
    expect(evaluateResidentialGroupUnlock([]).unlocked).toBe(false);
  });
});
