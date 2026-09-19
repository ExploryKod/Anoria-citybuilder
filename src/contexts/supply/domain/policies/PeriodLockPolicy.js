/**
 * Generic once-per-period lock. Two storage shapes, chosen by whether the
 * catalog's `periodLock` fact declares a `field`:
 *
 *  - `{ field, unit }` — a single dedicated building field (e.g. a farm's
 *    `lastProductionYear`). Reserve this for a role that will only ever
 *    hold ONE such lock (today: quantity-mode food production/consumption).
 *  - `{ unit }` (no `field`) — the SHARED_FLAG_FIELD object, keyed by
 *    category (e.g. `servedFlags: { faith: 3, education: 4 }`). This is
 *    the same "one field, many keys" shape `stocks` already uses for
 *    quantity resources (`{ wheat, carrot, food }`) — applied here to
 *    flag-mode services so adding the Nth service (Chapel, a school, ...)
 *    never needs a new top-level field name, only a new catalog entry.
 *
 * Either way this module has no notion of "producer", "consumer", or any
 * particular resource/service name — only "a place to remember a period
 * key". Replaces the old ResourceBookkeepingCatalog.js
 * PRODUCER_BOOKKEEPING/CONSUMER_BOOKKEEPING named exports — see
 * docs/period-lock-catalog-refactor.md.
 */

export const SHARED_FLAG_FIELD = 'servedFlags';

/**
 * @param {'year' | 'month'} unit
 * @param {object} period
 * @returns {number}
 */
function resolvePeriodKey(unit, period) {
  switch (unit) {
    case 'year':
      return Number.isFinite(period.year) ? Math.floor(period.year) : 0;
    case 'month':
      return Number.isFinite(period.monthIndex) ? Math.floor(period.monthIndex) : 0;
    default:
      throw new Error(`[PeriodLockPolicy] unknown period unit "${unit}"`);
  }
}

/**
 * @param {object} building
 * @param {{ field?: string, unit: 'year' | 'month' }} periodLock
 * @param {object} period
 * @param {string} [category] Required when `periodLock.field` is absent —
 *   the key into the shared flag field.
 * @returns {boolean} True when this building already ran for this period.
 */
export function isLockedForPeriod(building, periodLock, period, category) {
  if (!periodLock) return false;
  const periodKey = resolvePeriodKey(periodLock.unit, period);
  if (periodLock.field) {
    return building[periodLock.field] === periodKey;
  }
  return building[SHARED_FLAG_FIELD]?.[category] === periodKey;
}

/**
 * @param {object} building Current building row/snapshot — read (not
 *   mutated) when the shared flag field needs merging with its other keys,
 *   so setting one service's flag never clobbers another's.
 * @param {{ field?: string, unit: 'year' | 'month' }} periodLock
 * @param {object} period
 * @param {string} [category] Required when `periodLock.field` is absent.
 * @param {object} [extraFields] Additional fields to persist alongside the
 *   lock (e.g. a consumption record) — caller-specific, not part of the
 *   lock's own identity.
 * @returns {object} Field update to pass to `repository.updateBuildingFields`.
 */
export function buildLockUpdate(building, periodLock, period, category, extraFields = {}) {
  const periodKey = resolvePeriodKey(periodLock.unit, period);
  if (periodLock.field) {
    return { [periodLock.field]: periodKey, ...extraFields };
  }
  return {
    [SHARED_FLAG_FIELD]: { ...building[SHARED_FLAG_FIELD], [category]: periodKey },
    ...extraFields,
  };
}
