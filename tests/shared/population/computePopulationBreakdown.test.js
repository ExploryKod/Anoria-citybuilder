import { describe, test, expect } from '@jest/globals';
import { computePopulationBreakdown } from '../../../src/shared/population/computePopulationBreakdown.js';

// Civil servants were removed (2026-10-10, "suppress it for now"): a resident is either a worker or
// unemployed — the pool is no longer reduced by a fixed civil-servant share first.
describe('computePopulationBreakdown', () => {
  test('partitions total into active citizens and unemployed', () => {
    const breakdown = computePopulationBreakdown({
      workerPool: 50,
      totalAssigned: 42,
    });

    expect(breakdown.totalPopulation).toBe(50);
    expect(breakdown.unemployed).toBe(8);
    expect(breakdown.activeCitizenCount).toBe(42);
    expect(breakdown.unemploymentPercentage).toBe(16);
  });

  test('nobody assigned means everybody unemployed', () => {
    const breakdown = computePopulationBreakdown({
      workerPool: 12,
      totalAssigned: 0,
    });

    expect(breakdown.unemployed).toBe(12);
    expect(breakdown.activeCitizenCount).toBe(0);
  });

  test('fully assigned means nobody unemployed', () => {
    const breakdown = computePopulationBreakdown({
      workerPool: 12,
      totalAssigned: 12,
    });

    expect(breakdown.unemployed).toBe(0);
    expect(breakdown.activeCitizenCount).toBe(12);
  });
});
