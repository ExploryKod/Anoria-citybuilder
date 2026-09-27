/**
 * Behavior tests — Housing: HouseLevelPolicy's service-coverage helpers
 * (2026-09-11) — back the house info panel's Services tab "Chapel/Doctor/...
 * reached or not" chips, the same way road/market reach already show.
 */
import { describe, test, expect } from '@jest/globals';
import {
  relevantServiceCoverageRequirements,
  describeRelevantServiceCoverage,
} from '../../../src/contexts/housing/domain/policies/HouseLevelPolicy.js';

describe('HouseLevelPolicy — relevantServiceCoverageRequirements', () => {
  test('a tier-1 house shows only the next tier\'s services (Chapel/faith)', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 1, residentialGroup: 'artisans' });
    expect(requirements).toEqual([{ kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 }]);
  });

  test('a tier-2 house shows what unlocks tier 3 (faith is already behind it, doctor is next)', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 2, residentialGroup: 'artisans' });
    expect(requirements).toEqual([
      { kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2 },
      { kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 },
    ]);
  });

  test('a maxed-out house (tier 5) shows its own final tier\'s full service list', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 5, residentialGroup: 'artisans' });
    expect(requirements.map((r) => r.category)).toEqual([
      'faith', 'doctor', 'publicBath', 'pub', 'school', 'cinema',
    ]);
  });

  test('no residential group has no service requirements to show', () => {
    expect(relevantServiceCoverageRequirements({ level: 2, residentialGroup: null })).toEqual([]);
  });
});

describe('HouseLevelPolicy — describeRelevantServiceCoverage', () => {
  test('marks a service met when servedFlags matches the CURRENT period', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      servedFlags: { faith: 4 },
      periodKey: 4,
    });
    expect(described).toEqual([
      { kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2, current: 1, target: 1, met: true },
    ]);
  });

  test('still met within the coverage window (faith\'s coveragePeriods: 2) even one period stale', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      servedFlags: { faith: 3 },
      periodKey: 4,
    });
    expect(described[0].met).toBe(true);
  });

  test('reads as not met once the gap reaches coveragePeriods — a true interruption of service', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      servedFlags: { faith: 2 },
      periodKey: 4,
    });
    expect(described[0].met).toBe(false);
  });

  test('a tier-2 house sees BOTH an already-met service and an unmet one side by side', () => {
    const described = describeRelevantServiceCoverage({
      level: 2,
      residentialGroup: 'scholars',
      servedFlags: { faith: 9 },
      periodKey: 9,
    });
    expect(described).toEqual([
      { kind: 'serviceCoverage', category: 'faith', coveragePeriods: 2, current: 1, target: 1, met: true },
      { kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2, current: 0, target: 1, met: false },
    ]);
  });
});
