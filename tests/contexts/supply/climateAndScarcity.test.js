import { describe, test, expect } from '@jest/globals';
import { cropHarvestFactor, drawClimateYear, isClimateCrop } from '../../../src/shared/climate/ClimatePolicy.js';
import { coverOf, scarcityFactorOf } from '../../../src/contexts/supply/domain/policies/ScarcityPolicy.js';
import { YearClimate } from '../../../src/contexts/supply/application/services/YearClimate.js';

// The climate sets the yield of the fields; the gap between the food held and the food expected moves the price (docs/gameplay/PLAN_CRISES.md).
describe('the climate of the years', () => {
  test('a year follows the previous one\'s phase, and a crop feels the swing as much as it is sensitive', () => {
    expect(drawClimateYear({ previousPhase: 'normal', random: () => 0 })).toMatchObject({ phase: 'normal' });
    // The last sliver of a row of chances is a disaster only after a poor year: from a disastrous one it is another disastrous year.
    expect(drawClimateYear({ previousPhase: 'disastrous', random: () => 0.99 }).phase).toBe('disastrous');
    expect(cropHarvestFactor({ category: 'wheat', yearFactor: 0.6 })).toBeCloseTo(0.6);
    expect(cropHarvestFactor({ category: 'cabbage', yearFactor: 0.6 })).toBeCloseTo(0.8);
    expect(isClimateCrop('furniture')).toBe(false);
  });

  test('a year is drawn once and kept, the years in order', async () => {
    let saved = {};
    let draws = 0;
    const climate = new YearClimate({ repository: { get: async () => ({ ...saved }), save: async (years) => { saved = years; } }, random: () => { draws += 1; return 0.5; } });
    const third = await climate.of(2);
    expect(Object.keys(saved)).toEqual(['0', '1', '2']);
    const drawnSoFar = draws;
    expect(await climate.of(2)).toEqual(third);
    expect(draws).toBe(drawnSoFar);
  });
});

describe('scarcity moves the price of food', () => {
  test('the stock a normal year leaves is no gap: the price is the price', () => {
    // Just after the harvest: twelve months held, twelve to go. Right before the next: nothing held, nothing to wait for.
    expect(scarcityFactorOf(coverOf({ stock: 120, monthlyDemand: 10, monthsToHarvest: 12 }).gapMonths)).toBe(1);
    expect(scarcityFactorOf(coverOf({ stock: 0, monthlyDemand: 10, monthsToHarvest: 0 }).gapMonths)).toBe(1);
  });

  test('a harvest of 70 % makes the price about three times higher, a glut halves it', () => {
    const short = coverOf({ stock: 84, monthlyDemand: 10, monthsToHarvest: 12 });
    expect(short.gapMonths).toBeCloseTo(-3.6);
    expect(scarcityFactorOf(short.gapMonths)).toBeCloseTo(2.8);
    expect(scarcityFactorOf(coverOf({ stock: 240, monthlyDemand: 10, monthsToHarvest: 12 }).gapMonths)).toBe(0.5);
  });
});
