/** The calendar's names and the ids the catalogs' schedules use are one list read twice: they must stay the same length, so the supply's labels are derived from them. */
import { describe, test, expect } from '@jest/globals';
import { MONTHS, MONTH_IDS, SEASONS, SEASON_IDS } from '../../src/shared/time/TimeCalendar.js';
import { toDisplayMonth, toSupplyMonth, toDisplaySeason, toSupplySeason } from '../../src/composition/supplyTimeLabels.js';

describe('calendar ids', () => {
  test('months and seasons line up with their ids, both ways', () => {
    expect(MONTH_IDS).toHaveLength(MONTHS.length);
    expect(SEASON_IDS).toHaveLength(SEASONS.length);
    MONTHS.forEach((name, index) => {
      expect(toSupplyMonth(name)).toBe(MONTH_IDS[index]);
      expect(toDisplayMonth(MONTH_IDS[index])).toBe(name);
    });
    SEASONS.forEach((name, index) => {
      expect(toSupplySeason(name)).toBe(SEASON_IDS[index]);
      expect(toDisplaySeason(SEASON_IDS[index])).toBe(name);
    });
  });
});
