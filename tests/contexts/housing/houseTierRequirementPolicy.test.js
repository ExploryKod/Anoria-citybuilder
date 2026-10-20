import { describe, test, expect, jest } from '@jest/globals';
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
    expect(meetsTierRequirements([{ kind: 'unknownFutureKind' }], { pop: 99, roadCount: 99 })).toBe(false);
  });

  describe('serviceCoverage — generic, no service name baked in here', () => {
    test('met when servedFlags has this exact category served for the current period', () => {
      const requirements = [{ kind: 'serviceCoverage', category: 'fire', coveragePeriods: 2 }];
      expect(
        meetsTierRequirements(requirements, { servedFlags: { fire: 7 }, periodKey: 7 })
      ).toBe(true);
    });

    test('still met within the coverage window even without a fresh visit this exact period', () => {
      // coveragePeriods: 2 means a visit at period 6 still covers period 7
      // (7 - 6 = 1 < 2) — the "true interruption" only happens once the gap
      // reaches coveragePeriods.
      const requirements = [{ kind: 'serviceCoverage', category: 'fire', coveragePeriods: 2 }];
      expect(meetsTierRequirements(requirements, { servedFlags: { fire: 6 }, periodKey: 7 })).toBe(true);
    });

    test('not met once the gap since the last visit reaches coveragePeriods, or servedFlags is missing/absent', () => {
      const requirements = [{ kind: 'serviceCoverage', category: 'fire', coveragePeriods: 2 }];
      expect(meetsTierRequirements(requirements, { servedFlags: { fire: 5 }, periodKey: 7 })).toBe(false);
      expect(meetsTierRequirements(requirements, { servedFlags: {}, periodKey: 7 })).toBe(false);
      expect(meetsTierRequirements(requirements, { periodKey: 7 })).toBe(false);
    });

    test('two different categories are independent — one served does not satisfy the other', () => {
      const requirements = [{ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 }];
      expect(
        meetsTierRequirements(requirements, { servedFlags: { fire: 7 }, periodKey: 7 })
      ).toBe(false);
    });

    test('not met when periodKey itself is missing, even if servedFlags happens to also be absent', () => {
      // Regression guard: servedFlags?.[category] === periodKey must not
      // vacuously pass just because both sides are undefined.
      const requirements = [{ kind: 'serviceCoverage', category: 'fire', coveragePeriods: 2 }];
      expect(meetsTierRequirements(requirements, {})).toBe(false);
    });

    test('a missing or invalid coveragePeriods is a catalog authoring error — fails closed and logs it', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const withoutIt = [{ kind: 'serviceCoverage', category: 'fire' }];
        expect(meetsTierRequirements(withoutIt, { servedFlags: { fire: 7 }, periodKey: 7 })).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"fire"'));

        consoleErrorSpy.mockClear();
        const zeroed = [{ kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 0 }];
        expect(meetsTierRequirements(zeroed, { servedFlags: { doctor: 7 }, periodKey: 7 })).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"doctor"'));
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('demandMet — generic "this good\'s demand was fully met" this period (food today)', () => {
    test('met when lastConsumption is fresh (this period) and nothing went unfed', () => {
      const requirements = [{ kind: 'demandMet' }];
      expect(
        meetsTierRequirements(requirements, { lastConsumption: { month: 7, totalUnfed: 0 }, periodKey: 7 })
      ).toBe(true);
    });

    test('not met when unfed, stale (a previous period), or missing entirely', () => {
      const requirements = [{ kind: 'demandMet' }];
      expect(
        meetsTierRequirements(requirements, { lastConsumption: { month: 7, totalUnfed: 1 }, periodKey: 7 })
      ).toBe(false);
      expect(
        meetsTierRequirements(requirements, { lastConsumption: { month: 6, totalUnfed: 0 }, periodKey: 7 })
      ).toBe(false);
      expect(meetsTierRequirements(requirements, { periodKey: 7 })).toBe(false);
      expect(meetsTierRequirements(requirements, { lastConsumption: { month: 7, totalUnfed: 0 } })).toBe(false);
    });
  });

  describe('goodsVariety — N distinct goods of one need drawn from this period (the retail goods)', () => {
    const requirements = [{ kind: 'goodsVariety', min: 2, outcomeField: 'lastGoodsConsumption' }];

    test('met when at least the declared minimum of distinct goods were taken this period', () => {
      expect(
        meetsTierRequirements(requirements, {
          outcomes: { lastGoodsConsumption: { month: 7, categoriesTaken: ['pot', 'plate'] } },
          periodKey: 7,
        })
      ).toBe(true);
    });

    test('not met with fewer distinct goods, a stale period, or no record of the need', () => {
      expect(
        meetsTierRequirements(requirements, {
          outcomes: { lastGoodsConsumption: { month: 7, categoriesTaken: ['pot'] } },
          periodKey: 7,
        })
      ).toBe(false);
      expect(
        meetsTierRequirements(requirements, {
          outcomes: { lastGoodsConsumption: { month: 6, categoriesTaken: ['pot', 'plate'] } },
          periodKey: 7,
        })
      ).toBe(false);
      expect(meetsTierRequirements(requirements, { periodKey: 7 })).toBe(false);
    });

    test('a requirement that names no outcomeField is a catalog authoring error — fails closed and logs it', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const withoutIt = [{ kind: 'goodsVariety', min: 1 }];
        expect(meetsTierRequirements(withoutIt, { outcomes: { lastGoodsConsumption: { month: 7, categoriesTaken: ['pot'] } }, periodKey: 7 })).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('outcomeField'));
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('serviceDemandMet — a need served as a quantity (water, energy), read off its own record', () => {
    const requirements = [{ kind: 'serviceDemandMet', category: 'water', outcomeField: 'lastWaterConsumption' }];

    test('met when its record is fresh and nothing went unserved', () => {
      expect(meetsTierRequirements(requirements, { outcomes: { lastWaterConsumption: { month: 7, totalUnfed: 0 } }, periodKey: 7 })).toBe(true);
    });

    test('not met when short, stale, or without a record', () => {
      expect(meetsTierRequirements(requirements, { outcomes: { lastWaterConsumption: { month: 7, totalUnfed: 3 } }, periodKey: 7 })).toBe(false);
      expect(meetsTierRequirements(requirements, { outcomes: { lastWaterConsumption: { month: 6, totalUnfed: 0 } }, periodKey: 7 })).toBe(false);
      expect(meetsTierRequirements(requirements, { periodKey: 7 })).toBe(false);
    });
  });

  describe('activityAccess — a warehouse within reach of the house\'s business', () => {
    test('met only when the caller says so', () => {
      const requirements = [{ kind: 'activityAccess' }];
      expect(meetsTierRequirements(requirements, { activityAccess: true })).toBe(true);
      expect(meetsTierRequirements(requirements, { activityAccess: false })).toBe(false);
      expect(meetsTierRequirements(requirements, {})).toBe(false);
    });
  });
});
