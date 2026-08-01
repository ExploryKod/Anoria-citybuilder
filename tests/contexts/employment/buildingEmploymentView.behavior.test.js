/**
 * Behavior tests — Employment: per-building worker read model (legacy EmploymentModule logic)
 */

import { describe, test, expect } from '@jest/globals';
import {
  normalizeBuildingEmployees,
  getWorkerDeficit,
  needsWorkers,
  isFullyStaffed,
  getEmploymentRate,
  hasWorkers,
  getWorkerCount,
  getWorkerNeed,
} from '../../../src/contexts/employment/domain/policies/BuildingEmploymentViewPolicy.js';

describe('BuildingEmploymentViewPolicy', () => {
  describe('normalizeBuildingEmployees', () => {
    test('returns input when provided', () => {
      const employees = { worker: 2, worker_need: 3 };
      expect(normalizeBuildingEmployees(employees)).toEqual(employees);
    });

    test('uses defaults when null', () => {
      expect(normalizeBuildingEmployees(null)).toEqual({ worker: 0, worker_need: 0 });
    });

    test('uses defaults when undefined', () => {
      expect(normalizeBuildingEmployees(undefined)).toEqual({ worker: 0, worker_need: 0 });
    });
  });

  describe('getWorkerDeficit', () => {
    test('returns 0 when fully staffed', () => {
      expect(getWorkerDeficit({ worker: 3, worker_need: 3 })).toBe(0);
    });

    test('returns missing worker count', () => {
      expect(getWorkerDeficit({ worker: 1, worker_need: 3 })).toBe(2);
    });

    test('returns 0 when overstaffed', () => {
      expect(getWorkerDeficit({ worker: 5, worker_need: 3 })).toBe(0);
    });

    test('returns worker_need when worker is 0', () => {
      expect(getWorkerDeficit({ worker: 0, worker_need: 3 })).toBe(3);
    });

    test('returns 0 when worker_need is 0', () => {
      expect(getWorkerDeficit({ worker: 0, worker_need: 0 })).toBe(0);
    });

    test('treats undefined worker as 0', () => {
      expect(getWorkerDeficit({ worker: undefined, worker_need: 3 })).toBe(3);
    });
  });

  describe('needsWorkers', () => {
    test('true when deficit > 0', () => {
      expect(needsWorkers({ worker: 1, worker_need: 3 })).toBe(true);
    });

    test('false when fully staffed', () => {
      expect(needsWorkers({ worker: 3, worker_need: 3 })).toBe(false);
    });

    test('false when no workers needed', () => {
      expect(needsWorkers({ worker: 0, worker_need: 0 })).toBe(false);
    });

    test('false when overstaffed', () => {
      expect(needsWorkers({ worker: 5, worker_need: 3 })).toBe(false);
    });
  });

  describe('isFullyStaffed', () => {
    test('true when worker equals worker_need', () => {
      expect(isFullyStaffed({ worker: 3, worker_need: 3 })).toBe(true);
    });

    test('true when overstaffed', () => {
      expect(isFullyStaffed({ worker: 5, worker_need: 3 })).toBe(true);
    });

    test('false when understaffed', () => {
      expect(isFullyStaffed({ worker: 1, worker_need: 3 })).toBe(false);
    });

    test('true when worker_need is 0', () => {
      expect(isFullyStaffed({ worker: 0, worker_need: 0 })).toBe(true);
    });
  });

  describe('getEmploymentRate', () => {
    test('returns 100 when fully staffed', () => {
      expect(getEmploymentRate({ worker: 3, worker_need: 3 })).toBe(100);
    });

    test('returns 100 when worker_need is 0', () => {
      expect(getEmploymentRate({ worker: 0, worker_need: 0 })).toBe(100);
    });

    test('calculates percentage', () => {
      expect(getEmploymentRate({ worker: 2, worker_need: 4 })).toBe(50);
    });

    test('rounds to 33% for 1/3', () => {
      expect(getEmploymentRate({ worker: 1, worker_need: 3 })).toBe(33);
    });

    test('rounds to 67% for 2/3', () => {
      expect(getEmploymentRate({ worker: 2, worker_need: 3 })).toBe(67);
    });

    test('returns 0 when no workers assigned', () => {
      expect(getEmploymentRate({ worker: 0, worker_need: 3 })).toBe(0);
    });

    test('caps at 100 when overstaffed', () => {
      expect(getEmploymentRate({ worker: 10, worker_need: 3 })).toBe(100);
    });
  });

  describe('hasWorkers', () => {
    test('true when worker > 0', () => {
      expect(hasWorkers({ worker: 1, worker_need: 3 })).toBe(true);
    });

    test('false when worker is 0', () => {
      expect(hasWorkers({ worker: 0, worker_need: 3 })).toBe(false);
    });

    test('false when worker is undefined', () => {
      expect(hasWorkers({ worker_need: 3 })).toBe(false);
    });
  });

  describe('getWorkerCount / getWorkerNeed', () => {
    test('returns worker count', () => {
      expect(getWorkerCount({ worker: 2, worker_need: 3 })).toBe(2);
    });

    test('returns worker need', () => {
      expect(getWorkerNeed({ worker: 2, worker_need: 3 })).toBe(3);
    });

    test('returns 0 for missing properties', () => {
      expect(getWorkerCount({})).toBe(0);
      expect(getWorkerNeed({})).toBe(0);
    });
  });
});
