/**
 * Generic once-per-period lock: reads/writes a single building field whose
 * name and period unit are declared per `resourceRoles` entry in the
 * building catalog (`periodLock` — see buildingCatalog.js). This module has
 * no notion of "producer", "consumer", or any other named role — only "a
 * field, a unit, a value" — so a new role or resource never needs a new
 * named bookkeeping shape here, only a `periodLock` fact on its own catalog
 * entry. Replaces the old ResourceBookkeepingCatalog.js
 * PRODUCER_BOOKKEEPING/CONSUMER_BOOKKEEPING named exports — see
 * docs/period-lock-catalog-refactor.md.
 */

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
 * @param {{ field: string, unit: 'year' | 'month' }} periodLock
 * @param {object} period
 * @returns {boolean} True when this building already ran for this period.
 */
export function isLockedForPeriod(building, periodLock, period) {
  if (!periodLock) return false;
  return building[periodLock.field] === resolvePeriodKey(periodLock.unit, period);
}

/**
 * @param {{ field: string, unit: 'year' | 'month' }} periodLock
 * @param {object} period
 * @param {object} [extraFields] Additional fields to persist alongside the
 *   lock (e.g. a consumption record) — caller-specific, not part of the
 *   lock's own identity.
 * @returns {object} Field update to pass to `repository.updateBuildingFields`.
 */
export function buildLockUpdate(periodLock, period, extraFields = {}) {
  return { [periodLock.field]: resolvePeriodKey(periodLock.unit, period), ...extraFields };
}
