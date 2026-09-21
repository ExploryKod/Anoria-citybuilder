/**
 * Supply BC — evaluates a `resourceRoles` entry's declarative `schedule`
 * against the current time context, shared by every resource (food today,
 * any future one — see buildingEconomy.js).
 *
 * `unit` is not a fixed vocabulary of calendar concepts — it's just the name
 * of whichever field of the time context this schedule cares about
 * ('season', 'month', 'year', 'totalDays', or any future one the caller
 * supplies, e.g. 'weekday'). What shape the check takes depends on what the
 * schedule declares alongside it, not on which unit was named:
 *   - `values` (an array): membership check — `context[unit]` must be one of
 *     them. Fits any cyclic, enumerable unit (season, month, a future
 *     'moonPhase', ...) — no interval math needed, "quarterly" is just the
 *     right 4 months named.
 *   - `interval` (a number): modulo check — `context[unit] % interval === 0`.
 *     Fits any unbounded, ever-increasing unit (year, totalDays, a future
 *     running turn count) that can't be enumerated as a finite list.
 *   - `unit: 'always'`: fires unconditionally — a role with no gating at all
 *     (e.g. a market that restocks/distributes on every monthly tick).
 *
 * Adding a new calendar concept later needs no code here — only a new field
 * on whatever time context object callers already build, and a catalog
 * value naming it. Season is not privileged over any other unit.
 */

/**
 * @param {{ unit: string, values?: string[], interval?: number } | null | undefined} schedule
 * @param {Record<string, string | number | undefined>} context
 * @returns {boolean}
 */
export function matchesSchedule(schedule, context) {
  if (!schedule) return false;
  if (schedule.unit === 'always') return true;

  if (Array.isArray(schedule.values)) {
    return schedule.values.includes(context[schedule.unit]);
  }

  if (Number.isFinite(schedule.interval)) {
    const value = context[schedule.unit];
    return Number.isFinite(value) && schedule.interval > 0 && value % schedule.interval === 0;
  }

  return false;
}

/**
 * How many months until a schedule next fires, counting from the month after the current one
 * (the current month has already run). The calendar stays outside: the caller supplies the time
 * context of the month `monthsAhead` from now, so any calendar (and any schedule unit) works.
 *
 * @param {{ unit: string, values?: string[], interval?: number } | null | undefined} schedule
 * @param {(monthsAhead: number) => Record<string, string | number | undefined>} contextAhead
 * @param {number} [horizon] Furthest month to look at (a year by default).
 * @returns {number | null} Months until it next fires, or null when it does not within the horizon.
 */
export function monthsUntilNextMatch(schedule, contextAhead, horizon = 12) {
  if (!schedule) return null;
  for (let monthsAhead = 1; monthsAhead <= horizon; monthsAhead += 1) {
    if (matchesSchedule(schedule, contextAhead(monthsAhead))) return monthsAhead;
  }
  return null;
}

