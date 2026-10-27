/**
 * Behavior tests — Housing: HouseLevelPolicy's evolution-requirement helpers — back the house info panel's Services tab
 * "Besoins pour l'évolution" section: EVERY requirement the tier ladder declares (population, food, water, a named
 * service's coverage, goods, energy, a warehouse within reach), each a plain met/unmet fact, except `roadAccess`
 * (Route already has its own, building-type-agnostic chip — see servicesInfoFormat.js).
 */
import { describe, test, expect } from '@jest/globals';
import {
  relevantServiceCoverageRequirements,
  describeRelevantServiceCoverage,
} from '../../../src/contexts/housing/domain/policies/HouseLevelPolicy.js';

const WATER = { kind: 'serviceDemandMet', category: 'water', outcomeField: 'lastWaterConsumption' };

describe('HouseLevelPolicy — relevantServiceCoverageRequirements', () => {
  test('a tier-1 house shows what unlocks tier 2: population, food, water, a dispensary and a primary school, road excluded', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 1, residentialGroup: 'artisans' });
    expect(requirements).toEqual([
      { kind: 'population', min: 1 },
      { kind: 'demandMet' },
      WATER,
      { kind: 'serviceCoverage', category: 'doctor', coveragePeriods: 2 },
      { kind: 'serviceCoverage', category: 'primarySchool', coveragePeriods: 2 },
    ]);
  });

  test('a tier-2 house shows what unlocks tier 3: goods, fire, a warehouse and energy join the earlier needs', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 2, residentialGroup: 'artisans' });
    expect(requirements.map((r) => r.category ?? r.kind)).toEqual([
      'population', 'demandMet', 'water', 'doctor', 'primarySchool', 'goodsVariety', 'fire', 'activityAccess', 'energy',
    ]);
  });

  test('a maxed-out house (tier 6) shows its own final tier\'s full requirement list, road excluded', () => {
    const requirements = relevantServiceCoverageRequirements({ level: 6, residentialGroup: 'artisans' });
    expect(requirements.some((r) => r.kind === 'roadAccess')).toBe(false);
    expect(requirements.map((r) => r.category).filter(Boolean)).toEqual(expect.arrayContaining(['water', 'doctor', 'primarySchool', 'fire', 'energy', 'hospital', 'police', 'pub', 'school', 'theatre', 'cinema', 'library']));
  });

  test('no residential group has no requirements to show', () => {
    expect(relevantServiceCoverageRequirements({ level: 2, residentialGroup: null })).toEqual([]);
  });
});

describe('HouseLevelPolicy — describeRelevantServiceCoverage', () => {
  // Water is an ordinary quantity-consumed need: read off its own record (ConsumeResource's outcome), no coverage-window
  // slack, met only for the CURRENT period and only once fully served (`totalUnfed: 0`).
  test('marks population and water met when both hold THIS period', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      pop: 1,
      outcomes: { lastWaterConsumption: { month: 4, totalUnfed: 0 } },
      periodKey: 4,
    });
    expect(described.find((r) => r.kind === 'population')).toMatchObject({ met: true });
    expect(described.find((r) => r.category === 'water')).toMatchObject({ current: 1, target: 1, met: true });
  });

  test('water reads as not met once the record is stale (a different period)', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      pop: 1,
      outcomes: { lastWaterConsumption: { month: 3, totalUnfed: 0 } },
      periodKey: 4,
    });
    expect(described.find((r) => r.category === 'water').met).toBe(false);
  });

  test('water reads as not met when the tank ran short this period (totalUnfed > 0)', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'merchants',
      pop: 1,
      outcomes: { lastWaterConsumption: { month: 4, totalUnfed: 1 } },
      periodKey: 4,
    });
    expect(described.find((r) => r.category === 'water').met).toBe(false);
  });

  test('food (demandMet) reads met once fully served this period, next to an unmet dispensary', () => {
    const described = describeRelevantServiceCoverage({
      level: 1,
      residentialGroup: 'scholars',
      pop: 4,
      lastConsumption: { month: 9, totalUnfed: 0 },
      outcomes: { lastWaterConsumption: { month: 9, totalUnfed: 0 } },
      periodKey: 9,
    });
    expect(described.find((r) => r.kind === 'demandMet')).toMatchObject({ met: true, current: 1, target: 1 });
    expect(described.find((r) => r.category === 'doctor')).toMatchObject({ met: false });
  });

  test('a warehouse within reach of the house\'s business is a requirement of the second level, met only when told so', () => {
    const base = { level: 2, residentialGroup: 'scholars', pop: 4, periodKey: 9 };
    expect(describeRelevantServiceCoverage({ ...base, activityAccess: true }).find((r) => r.kind === 'activityAccess').met).toBe(true);
    expect(describeRelevantServiceCoverage({ ...base, activityAccess: false }).find((r) => r.kind === 'activityAccess').met).toBe(false);
    expect(describeRelevantServiceCoverage(base).find((r) => r.kind === 'activityAccess').met).toBe(false);
  });
});
