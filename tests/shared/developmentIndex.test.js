import { describe, expect, test } from '@jest/globals';
import { developmentIndexOf, incomeIndexOf, isServedNow } from '../../src/shared/population/DevelopmentIndexPolicy.js';
import { INCOME_GOALPOSTS } from '../../src/shared/population/DevelopmentCatalog.js';

describe('the human development index', () => {
  test('a service serves a house for the window of the tiers, the year turning included', () => {
    expect(isServedNow(5, 5)).toBe(true);
    expect(isServedNow(5, 6)).toBe(true);
    expect(isServedNow(5, 7)).toBe(false);
    expect(isServedNow(11, 0)).toBe(true);
    expect(isServedNow(undefined, 3)).toBe(false);
    expect(() => isServedNow(1, undefined)).toThrow('month now');
  });

  test('the income index is 0 at the lower goalpost and 1 at the upper, on a logarithmic scale', () => {
    expect(incomeIndexOf(INCOME_GOALPOSTS.min)).toBeCloseTo(0, 5);
    expect(incomeIndexOf(INCOME_GOALPOSTS.max)).toBeCloseTo(1, 5);
    expect(incomeIndexOf(INCOME_GOALPOSTS.max * 10)).toBe(1);
    expect(incomeIndexOf(Math.sqrt(INCOME_GOALPOSTS.min * INCOME_GOALPOSTS.max))).toBeCloseTo(0.5, 5);
  });

  test('while a dimension is at 0 the index is not valid: it is left out, and the dimension is named as what blocks it', () => {
    // No school, no library, no primary school serves anyone yet: the education is 0, so the index would be 0 whatever the rest is.
    const none = (group) => (group.includes('primarySchool') || group.includes('school') || group.includes('library') ? 0 : 1);
    const unbuilt = developmentIndexOf({ fedShare: 1, coverageOf: none, incomePerInhabitant: INCOME_GOALPOSTS.max });
    expect(unbuilt.hdi).toBeNull();
    expect(unbuilt.blockers).toEqual([{ kind: 'dimension', label: 'Éducation', serviceGroups: [['primarySchool'], ['school'], ['library']] }]);
    // The income under its lower goalpost blocks it too.
    expect(developmentIndexOf({ fedShare: 1, coverageOf: () => 1, incomePerInhabitant: INCOME_GOALPOSTS.min }).blockers).toEqual([{ kind: 'income', label: 'Revenu', goalpost: INCOME_GOALPOSTS.min }]);
  });

  test('the index is the geometric mean of the dimensions, and what cannot be read is never made up', () => {
    const full = developmentIndexOf({ fedShare: 1, coverageOf: () => 1, incomePerInhabitant: INCOME_GOALPOSTS.max });
    expect(full.hdi).toBeCloseTo(1, 5);
    const half = developmentIndexOf({ fedShare: 0.5, coverageOf: () => 0.5, incomePerInhabitant: Math.sqrt(INCOME_GOALPOSTS.min * INCOME_GOALPOSTS.max) });
    expect(half.hdi).toBeCloseTo(0.5, 3);
    // No market prices the needs yet: no income, so no index.
    expect(developmentIndexOf({ fedShare: 1, coverageOf: () => 1, incomePerInhabitant: null }).hdi).toBeNull();
    expect(developmentIndexOf({ fedShare: null, coverageOf: () => 1, incomePerInhabitant: 100 }).dimensions[0].index).toBeNull();
  });
});
