/**
 * Map TimeManager French season/month labels → Supply English catalogs.
 */

import { TimeManager } from '../shared/time/TimeManager.js';

const LEGACY_SEASON_TO_SUPPLY = Object.freeze({
  Printemps: 'spring',
  Été: 'summer',
  Automne: 'autumn',
  Hiver: 'winter',
});

const LEGACY_MONTH_TO_SUPPLY = Object.freeze({
  Janvier: 'january',
  Février: 'february',
  Mars: 'march',
  Avril: 'april',
  Mai: 'may',
  Juin: 'june',
  Juillet: 'july',
  Août: 'august',
  Septembre: 'september',
  Octobre: 'october',
  Novembre: 'november',
  Décembre: 'december',
});

/**
 * @param {string | null | undefined} legacySeason
 * @returns {'spring' | 'summer' | 'autumn' | 'winter' | null}
 */
export function toSupplySeason(legacySeason) {
  if (!legacySeason || typeof legacySeason !== 'string') return null;
  return LEGACY_SEASON_TO_SUPPLY[legacySeason] ?? null;
}

/**
 * @param {string | null | undefined} legacyMonth
 * @returns {'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december' | null}
 */
export function toSupplyMonth(legacyMonth) {
  if (!legacyMonth || typeof legacyMonth !== 'string') return null;
  return LEGACY_MONTH_TO_SUPPLY[legacyMonth] ?? null;
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
