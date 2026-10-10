/**
 * Behavior tests — Housing: HouseLevelPolicy's evolution-requirement helpers (2026-09-11, widened
 * 2026-10-10) — back the house info panel's Services tab "Besoins pour l'évolution" section: EVERY
 * requirement the tier ladder declares (population, food, a named service's coverage or demand), each a
 * plain met/unmet fact, except `roadAccess` (Route already has its own, building-type-agnostic chip —
 * see servicesInfoFormat.js).
 */
import { describe, test, expect } from '@jest/globals';
import {
  relevantServiceCoverageRequirements,
  describeRelevantServiceCoverage,
} from '../../../src/contexts/housing/domain/policies/HouseLevelPolicy.js';

describe('HouseLevelPolicy — relevantServiceCoverageRequirements', () => {
  test('a tier-1 house shows what unlocks tier 2: population and Chapel/faith, road excluded', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 1, residentialGroup: 'artisans' });
    expect(requirements).toEqual([
      { kind: 'population', min: 1 },
      { kind: 'serviceDemandMet', category: 'faith', outcomeField: 'lastFaithConsumption' },
    ]);
  });

  test('a tier-2 house shows what unlocks tier 3 (faith is already behind it, food and doctor are next)', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 2, residentialGroup: 'artisans' });
    expect(requirements).toEqual([
      { kind: 'population', min: 4 },
      { kind: 'serviceDemandMet', category: 'faith', outcomeField: 'lastFaithConsumption' },
      { kind: 'demandMet' },
      { kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 },
    ]);
  });

  test('a maxed-out house (tier 5) shows its own final tier\'s full requirement list, road excluded', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 5, residentialGroup: 'artisans' });
    expect(requirements.map((r) => r.kind)).toEqual([
      'population', 'serviceDemandMet', 'demandMet', 'serviceCoverage', 'serviceCoverage',
      'serviceCoverage', 'serviceCoverage', 'serviceCoverage', 'goodsVariety',
    ]);
    expect(requirements.some((r) => r.kind === 'roadAccess')).toBe(false);
  });

  test('no residential group has no requirements to show', () => {
    expect(relevantServiceCoverageRequirements({ level: 2, residentialGroup: null })).toEqual([]);
  });
});

describe('HouseLevelPolicy — describeRelevantServiceCoverage', () => {
  // Faith left flag mode (2026-10-10): it is now a 'serviceDemandMet' requirement, read off
  // `lastFaithConsumption` exactly like any other quantity-consumed need (ConsumeResource's outcome) — no
  // coverage-window slack, met only for the CURRENT period and only once fully served (`totalUnfed: 0`).
  test('marks population and faith met when both hold THIS period', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      pop: 1,
      lastFaithConsumption: { month: 4, totalUnfed: 0 },
      periodKey: 4,
    });
    expect(described).toEqual([
      { kind: 'population', min: 1, current: 1, target: 1, met: true },
      { kind: 'serviceDemandMet', category: 'faith', outcomeField: 'lastFaithConsumption', current: 1, target: 1, met: true },
    ]);
  });

  test('faith reads as not met once the outcome is stale (a different period)', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      pop: 1,
      lastFaithConsumption: { month: 3, totalUnfed: 0 },
      periodKey: 4,
    });
    expect(described.find((r) => r.kind === 'serviceDemandMet').met).toBe(false);
  });

  test('faith reads as not met when the chapel ran short this period (totalUnfed > 0)', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      pop: 1,
      lastFaithConsumption: { month: 4, totalUnfed: 1 },
      periodKey: 4,
    });
    expect(described.find((r) => r.kind === 'serviceDemandMet').met).toBe(false);
  });

  test('a tier-2 house sees an already-met service, an unmet food requirement, and an unmet doctor side by side', () => {
    const described = describeRelevantServiceCoverage({
      level: 2,
      residentialGroup: 'scholars',
      pop: 4,
      lastFaithConsumption: { month: 9, totalUnfed: 0 },
      periodKey: 9,
    });
    expect(described).toEqual([
      { kind: 'population', min: 4, current: 4, target: 4, met: true },
      { kind: 'serviceDemandMet', category: 'faith', outcomeField: 'lastFaithConsumption', current: 1, target: 1, met: true },
      { kind: 'demandMet', current: 0, target: 1, met: false },
      { kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2, current: 0, target: 1, met: false },
    ]);
  });

  test('food (demandMet) reads met once fully served this period', () => {
    const described = describeRelevantServiceCoverage({
      level: 2,
      residentialGroup: 'scholars',
      pop: 4,
      lastConsumption: { month: 9, totalUnfed: 0 },
      lastFaithConsumption: { month: 9, totalUnfed: 0 },
      periodKey: 9,
    });
    expect(described.find((r) => r.kind === 'demandMet')).toMatchObject({ met: true, current: 1, target: 1 });
  });
});
