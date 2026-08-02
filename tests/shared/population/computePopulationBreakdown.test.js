import { describe, test, expect } from '@jest/globals';
import { computePopulationBreakdown } from '../../../src/shared/population/computePopulationBreakdown.js';

describe('computePopulationBreakdown', () => {
  test('partitions total into active citizens, élites, fonctionnaires and unemployed', () => {
    const breakdown = computePopulationBreakdown({
      workerPool: 50,
      elitePool: 3,
      totalAssigned: 42,
    });

    expect(breakdown.totalPopulation).toBe(53);
    expect(breakdown.civilServantCount).toBe(4);
    expect(breakdown.laborPool).toBe(46);
    expect(breakdown.unemployed).toBe(4);
    expect(breakdown.activeCitizenCount).toBe(42);
    expect(breakdown.activePopulationCount).toBe(49);
    expect(breakdown.unemploymentPercentage).toBe(9);
    expect(breakdown.totalPopulation - breakdown.unemployed).toBe(breakdown.activePopulationCount);
  });

  test('at 12 inhabitants reserves one civil servant from the worker pool', () => {
    const allUnemployed = computePopulationBreakdown({
      workerPool: 12,
      elitePool: 0,
      totalAssigned: 0,
    });

    expect(allUnemployed.civilServantCount).toBe(1);
    expect(allUnemployed.unemployed).toBe(11);
    expect(allUnemployed.activeCitizenCount).toBe(0);

    const allActive = computePopulationBreakdown({
      workerPool: 12,
      elitePool: 0,
      totalAssigned: 11,
    });

    expect(allActive.unemployed).toBe(0);
    expect(allActive.activeCitizenCount).toBe(11);
  });

  test('allows up to twelve unemployed once population reaches thirteen', () => {
    const breakdown = computePopulationBreakdown({
      workerPool: 13,
      elitePool: 0,
      totalAssigned: 0,
    });

    expect(breakdown.civilServantCount).toBe(1);
    expect(breakdown.unemployed).toBe(12);
    expect(breakdown.activeCitizenCount).toBe(0);
  });
});
