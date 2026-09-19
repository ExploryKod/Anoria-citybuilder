/**
 * Unit tests — PeriodLockPolicy: the two once-per-period lock storage
 * shapes (dedicated `field` vs. the shared `servedFlags` object keyed by
 * category), and specifically that the shared shape never clobbers another
 * service's key when writing one.
 */

import { describe, test, expect } from '@jest/globals';
import {
  isLockedForPeriod,
  buildLockUpdate,
  SHARED_FLAG_FIELD,
} from '../../../src/contexts/supply/domain/policies/PeriodLockPolicy.js';

describe('PeriodLockPolicy', () => {
  describe('field-based lock (e.g. a farm harvest)', () => {
    const periodLock = { field: 'lastProductionYear', unit: 'year' };

    test('not locked when the field is unset', () => {
      expect(isLockedForPeriod({}, periodLock, { year: 3 })).toBe(false);
    });

    test('locked once the field matches the resolved period key', () => {
      expect(isLockedForPeriod({ lastProductionYear: 3 }, periodLock, { year: 3 })).toBe(true);
      expect(isLockedForPeriod({ lastProductionYear: 3 }, periodLock, { year: 4 })).toBe(false);
    });

    test('buildLockUpdate targets the named field only', () => {
      expect(buildLockUpdate({}, periodLock, { year: 3 })).toEqual({ lastProductionYear: 3 });
    });
  });

  describe('shared servedFlags lock (e.g. a flag-consumption service)', () => {
    const periodLock = { unit: 'month' };

    test('not locked when servedFlags has no entry for this category', () => {
      expect(isLockedForPeriod({}, periodLock, { monthIndex: 3 }, 'faith')).toBe(false);
      expect(isLockedForPeriod({ servedFlags: { education: 3 } }, periodLock, { monthIndex: 3 }, 'faith')).toBe(
        false
      );
    });

    test('locked once this category matches the resolved period key', () => {
      const building = { servedFlags: { faith: 3 } };
      expect(isLockedForPeriod(building, periodLock, { monthIndex: 3 }, 'faith')).toBe(true);
      expect(isLockedForPeriod(building, periodLock, { monthIndex: 4 }, 'faith')).toBe(false);
    });

    test('buildLockUpdate on an empty building creates the shared field with just this category', () => {
      expect(buildLockUpdate({}, periodLock, { monthIndex: 3 }, 'faith')).toEqual({
        [SHARED_FLAG_FIELD]: { faith: 3 },
      });
    });

    test('buildLockUpdate merges into existing servedFlags — never clobbers another service', () => {
      const building = { servedFlags: { education: 5 } };
      expect(buildLockUpdate(building, periodLock, { monthIndex: 3 }, 'faith')).toEqual({
        servedFlags: { education: 5, faith: 3 },
      });
    });

    test('buildLockUpdate overwrites only this category on re-service', () => {
      const building = { servedFlags: { faith: 2, education: 5 } };
      expect(buildLockUpdate(building, periodLock, { monthIndex: 3 }, 'faith')).toEqual({
        servedFlags: { faith: 3, education: 5 },
      });
    });
  });
});
