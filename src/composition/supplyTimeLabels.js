/**
 * Map TimeManager French season/month labels → Supply English catalogs.
 */

import { TimeManager } from '../shared/time/TimeManager.js';
import { MONTHS, MONTH_IDS, SEASONS, SEASON_IDS } from '../shared/time/TimeCalendar.js';

// Both maps are derived from the calendar's own lists (TimeCalendar.js), index-aligned: no second copy of the names.
const LEGACY_SEASON_TO_SUPPLY = Object.freeze(Object.fromEntries(SEASONS.map((name, index) => [name, SEASON_IDS[index]])));
const LEGACY_MONTH_TO_SUPPLY = Object.freeze(Object.fromEntries(MONTHS.map((name, index) => [name, MONTH_IDS[index]])));

/**
 * The id of a season the calendar names. Strict: a name the calendar does not have is a defect (the schedules would silently never match), not "no season".
 * @param {string} legacySeason
 * @returns {'spring' | 'summer' | 'autumn' | 'winter'}
 */
export function toSupplySeason(legacySeason) {
  const id = LEGACY_SEASON_TO_SUPPLY[legacySeason];
  if (!id) throw new Error(`[calendar] "${legacySeason}" is not a season of the calendar (${SEASONS.join(', ')})`);
  return id;
}

/**
 * The id of a month the calendar names. Strict, like the season's.
 * @param {string} legacyMonth
 * @returns {'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december'}
 */
export function toSupplyMonth(legacyMonth) {
  const id = LEGACY_MONTH_TO_SUPPLY[legacyMonth];
  if (!id) throw new Error(`[calendar] "${legacyMonth}" is not a month of the calendar (${MONTHS.join(', ')})`);
  return id;
}

/**
 * The time context Supply schedules read (season / month labels, year, month index) for the
 * month `monthsAhead` after the one `turn` falls in — the same shape the monthly cycle is given.
 * @param {number} turn Current game day.
 * @param {number} monthsAhead
 */
export function supplyTimeContextAhead(turn, monthsAhead) {
  const info = TimeManager.getTimeInfo(turn + monthsAhead * TimeManager.DAYS_PER_MONTH);
  return {
    season: toSupplySeason(info.season),
    month: toSupplyMonth(info.month),
    year: info.year,
    monthIndex: info.monthIndex,
  };
}

/** A schedule (catalog `when` / `schedule`) against the game's time — the presentation reads it through here. */
export { matchesSchedule } from '../contexts/supply/domain/policies/ResourceSchedulePolicy.js';

/** The way back: the name the player reads for a month/season a catalog schedule names in English. */
const SUPPLY_TO_DISPLAY_SEASON = Object.freeze(Object.fromEntries(Object.entries(LEGACY_SEASON_TO_SUPPLY).map(([display, supply]) => [supply, display])));
const SUPPLY_TO_DISPLAY_MONTH = Object.freeze(Object.fromEntries(Object.entries(LEGACY_MONTH_TO_SUPPLY).map(([display, supply]) => [supply, display])));

/** @param {string} supplySeason e.g. 'autumn' @returns {string | null} e.g. 'Automne' */
export function toDisplaySeason(supplySeason) {
  return SUPPLY_TO_DISPLAY_SEASON[supplySeason] ?? null;
}

/** @param {string} supplyMonth e.g. 'december' @returns {string | null} e.g. 'Décembre' */
export function toDisplayMonth(supplyMonth) {
  return SUPPLY_TO_DISPLAY_MONTH[supplyMonth] ?? null;
}

/** @param {number} monthIndex 0-based @returns {string | null} e.g. 'Janvier' */
export function displayMonthByIndex(monthIndex) {
  return Object.keys(LEGACY_MONTH_TO_SUPPLY)[monthIndex] ?? null;
}
