/**
 * ACL Employment — isEmploymentWorkplaceType
 */

import { describe, test, expect } from '@jest/globals';
import {
  isEmploymentWorkplaceType,
} from '../../src/js/acl/employment.js';

describe('ACL Employment — isEmploymentWorkplaceType', () => {
  test('workplaces with worker_need', () => {
    expect(isEmploymentWorkplaceType('Farm-Wheat')).toBe(true);
    expect(isEmploymentWorkplaceType('Market-Stall')).toBe(true);
    expect(isEmploymentWorkplaceType('Windmill-001')).toBe(true);
    expect(isEmploymentWorkplaceType('Winery-001')).toBe(true);
  });

  test('houses and roads are excluded', () => {
    expect(isEmploymentWorkplaceType('House-Blue')).toBe(false);
    expect(isEmploymentWorkplaceType('House-2Story')).toBe(false);
    expect(isEmploymentWorkplaceType('roads')).toBe(false);
    expect(isEmploymentWorkplaceType('StonePath-001')).toBe(false);
  });

  test('null/empty', () => {
    expect(isEmploymentWorkplaceType(null)).toBe(false);
    expect(isEmploymentWorkplaceType('')).toBe(false);
  });
});
