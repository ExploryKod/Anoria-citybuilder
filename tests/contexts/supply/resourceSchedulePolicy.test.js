import { describe, test, expect } from '@jest/globals';
import { matchesSchedule, monthsUntilNextMatch } from '../../../src/contexts/supply/domain/policies/ResourceSchedulePolicy.js';
import { TimeManager } from '../../../src/shared/time/TimeManager.js';
import { supplyTimeContextAhead } from '../../../src/composition/supplyTimeLabels.js';

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

describe('Supply — monthsUntilNextMatch: how far off a schedule next fires', () => {
  const december = { unit: 'month', values: ['december'] };
  // The months ahead are given as a context per step, whatever the calendar behind them.
  const calendar = (names) => (monthsAhead) => ({ month: names[monthsAhead % names.length] });

  test('counts the months from now to the next matching month', () => {
    expect(monthsUntilNextMatch(december, calendar(['june', 'july', 'august', 'september', 'october', 'november', 'december']))).toBe(6);
  });

  test('a schedule firing next month is one month away', () => {
    expect(monthsUntilNextMatch(december, calendar(['november', 'december']))).toBe(1);
  });

  test('the current month does not count: it has already run', () => {
    expect(monthsUntilNextMatch(december, calendar(['december', 'january', 'february']), 2)).toBeNull();
  });

  test('an always schedule fires every month; a schedule that never matches is null', () => {
    expect(monthsUntilNextMatch({ unit: 'always' }, calendar(['june']))).toBe(1);
    expect(monthsUntilNextMatch(december, calendar(['june']))).toBeNull();
    expect(monthsUntilNextMatch(undefined, calendar(['june']))).toBeNull();
  });

  test('works on the real game calendar: from June, December is six months off', () => {
    let day = 0;
    while (TimeManager.getTimeInfo(day).month !== 'Juin') day += 1;
    const ahead = (monthsAhead) => supplyTimeContextAhead(day, monthsAhead);
    expect(monthsUntilNextMatch(december, ahead)).toBe(6);
    // Just after the December collection, the next one is a full year away
    while (TimeManager.getTimeInfo(day).month !== 'Décembre') day += 1;
    expect(monthsUntilNextMatch(december, ahead)).toBe(12);
  });
});
