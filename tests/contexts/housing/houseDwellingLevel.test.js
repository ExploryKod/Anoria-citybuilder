import { describe, expect, test } from '@jest/globals';
import {
  getHouseDwellingLevelAriaLabel,
  getHouseDwellingLevelLabel,
  normalizeHouseDwellingLevel,
  resolveHouseDwellingStatusMessage,
} from '../../../src/contexts/housing/domain/value-objects/HouseDwellingLevel.js';

describe('HouseDwellingLevel', () => {
  test('maps technical levels to player-facing labels', () => {
    expect(getHouseDwellingLevelLabel(1)).toBe('cabane');
    expect(getHouseDwellingLevelLabel(2)).toBe('masure');
    expect(getHouseDwellingLevelLabel(99)).toBe('cabane');
    expect(normalizeHouseDwellingLevel(undefined)).toBe(1);
  });

  test('aria label keeps technical level for assistive tech', () => {
    expect(getHouseDwellingLevelAriaLabel(1)).toBe('cabane (niveau 1)');
    expect(getHouseDwellingLevelAriaLabel(2)).toBe('masure (niveau 2)');
  });

  test('status messages use dwelling names instead of niveau 1/2', () => {
    expect(resolveHouseDwellingStatusMessage(1, 2, false)).toContain('masure');
    expect(resolveHouseDwellingStatusMessage(1, 2, false)).not.toMatch(/niveau 2/);

    expect(resolveHouseDwellingStatusMessage(2, 4, false)).toContain('cabane');
    expect(resolveHouseDwellingStatusMessage(2, 4, false)).not.toMatch(/niveau 1/);

    expect(resolveHouseDwellingStatusMessage(1, 2, true)).toContain('masure');
  });
});
