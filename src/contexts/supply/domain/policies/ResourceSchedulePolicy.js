/**
 * Supply BC — evaluates a `resourceRoles` entry's declarative `schedule`
 * against the current time context. One small lookup table, keyed by
 * schedule `unit`, shared by every resource (food today, any future one —
 * see buildingEconomy.js).
 *
 * `season`/`month` take a `values` array of accepted names — a cyclic,
 * enumerable unit is fully expressed by "which of these fire", no interval
 * math needed (quarterly production is just the right 4 months named).
 * `everyNDays`/`everyNYears` take an `interval` instead, because an
 * absolute, ever-increasing count can't be enumerated as a finite list.
 * `always` fires every time it's checked — for a role with no gating at
 * all (e.g. a market that restocks/distributes on every monthly tick).
 *
 * Adding a new unit later is one function added here plus a catalog value;
 * nothing about how a schedule is declared or resolved elsewhere changes.
 * An unrecognized unit fails closed (never silently fires).
 */

/** @type {Readonly<Record<string, (schedule: object, context: object) => boolean>>} */
const SCHEDULE_EVALUATORS = Object.freeze({
  season: (schedule, context) => (schedule.values ?? []).includes(context.season),
  month: (schedule, context) => (schedule.values ?? []).includes(context.month),
  everyNDays: (schedule, context) =>
    Number.isFinite(context.totalDays) && schedule.interval > 0 && context.totalDays % schedule.interval === 0,
  everyNYears: (schedule, context) =>
    Number.isFinite(context.year) && schedule.interval > 0 && context.year % schedule.interval === 0,
  always: () => true,
});

/**
 * @param {{ unit: string } | null | undefined} schedule
 * @param {{ season?: string, month?: string, year?: number, totalDays?: number }} context
 * @returns {boolean}
 */
export function matchesSchedule(schedule, context) {
  if (!schedule) return false;
  const evaluate = SCHEDULE_EVALUATORS[schedule.unit];
  return evaluate ? evaluate(schedule, context) : false;
}
