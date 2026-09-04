import { describe, test, expect } from '@jest/globals';
import { matchesSchedule } from '../../../src/contexts/supply/domain/policies/ResourceSchedulePolicy.js';

describe('Supply — ResourceSchedulePolicy', () => {
  test('always fires unconditionally', () => {
    expect(matchesSchedule({ unit: 'always' }, {})).toBe(true);
  });

  test('a values list is a membership check against the named context field — works for any unit name', () => {
    expect(matchesSchedule({ unit: 'season', values: ['autumn'] }, { season: 'autumn' })).toBe(true);
    expect(matchesSchedule({ unit: 'season', values: ['autumn'] }, { season: 'summer' })).toBe(false);
    expect(matchesSchedule({ unit: 'month', values: ['december'] }, { month: 'december' })).toBe(true);
    // Season isn't privileged — any named context field works the same way.
    expect(matchesSchedule({ unit: 'moonPhase', values: ['full'] }, { moonPhase: 'full' })).toBe(true);
  });

  test('an interval is a modulo check against the named context field — works for any unit name', () => {
    expect(matchesSchedule({ unit: 'year', interval: 3 }, { year: 9 })).toBe(true);
    expect(matchesSchedule({ unit: 'year', interval: 3 }, { year: 10 })).toBe(false);
    expect(matchesSchedule({ unit: 'totalDays', interval: 15 }, { totalDays: 30 })).toBe(true);
  });

  test('missing or non-finite context value never matches an interval', () => {
    expect(matchesSchedule({ unit: 'year', interval: 3 }, {})).toBe(false);
    expect(matchesSchedule({ unit: 'year', interval: 3 }, { year: 'not-a-number' })).toBe(false);
  });

  test('a schedule with neither values nor interval never fires', () => {
    expect(matchesSchedule({ unit: 'season' }, { season: 'autumn' })).toBe(false);
  });

  test('no schedule never fires', () => {
    expect(matchesSchedule(null, { season: 'autumn' })).toBe(false);
    expect(matchesSchedule(undefined, {})).toBe(false);
  });
});
