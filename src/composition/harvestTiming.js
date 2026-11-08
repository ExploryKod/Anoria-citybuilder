import { getAnnualHarvestSchedule } from '../shared/building-catalog/resourceRoleQueries.js';
import { matchesSchedule, monthsUntilNextMatch } from '../contexts/supply/domain/policies/ResourceSchedulePolicy.js';
import { supplyTimeContextAhead } from './supplyTimeLabels.js';

/**
 * Months until the next harvest from a turn, the catalog's schedule read as the supply cycle reads it (the time context the supply's schedules use): 0 while the harvest is on.
 * @param {number} turn
 * @returns {number | null} null when the catalog declares no annual harvest, or none within a year
 */
export function monthsToHarvestAt(turn) {
  const schedule = getAnnualHarvestSchedule();
  if (matchesSchedule(schedule, supplyTimeContextAhead(turn, 0))) return 0;
  return monthsUntilNextMatch(schedule, (monthsAhead) => supplyTimeContextAhead(turn, monthsAhead));
}
