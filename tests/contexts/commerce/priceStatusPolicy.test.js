import { describe, test, expect } from '@jest/globals';
import { getPriceStatus } from '../../../src/contexts/commerce/domain/policies/PriceStatusPolicy.js';

describe('PriceStatusPolicy', () => {
  test('selling thresholds', () => {
    expect(getPriceStatus(60, 100, 'selling')).toBe('generous');
    expect(getPriceStatus(160, 100, 'selling')).toBe('unacceptable');
    expect(getPriceStatus(100, 100, 'selling')).toBe('');
  });

  test('buying thresholds', () => {
    expect(getPriceStatus(140, 100, 'buying')).toBe('generous');
    expect(getPriceStatus(40, 100, 'buying')).toBe('unacceptable');
    expect(getPriceStatus(100, 100, 'buying')).toBe('');
  });
});
