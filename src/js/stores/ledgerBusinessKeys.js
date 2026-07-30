/** Types with at most one persisted entry per civil month. */
const MONTHLY_IDEMPOTENT_TYPES = new Set([
  'salary',
  'payroll_tax',
  'maintenance',
]);

/** Types with at most one entry per civil year. */
const YEARLY_IDEMPOTENT_TYPES = new Set(['citizen_tax']);

/**
 * @param {string} type
 * @param {{ year: number, monthIndex: number }} timeInfo
 * @returns {string | null}
 */
export function buildLedgerBusinessKey(type, timeInfo) {
  if (!timeInfo || typeof timeInfo.year !== 'number') {
    return null;
  }
  if (MONTHLY_IDEMPOTENT_TYPES.has(type)) {
    return `${type}:${timeInfo.year}:${timeInfo.monthIndex}`;
  }
  if (YEARLY_IDEMPOTENT_TYPES.has(type)) {
    return `${type}:${timeInfo.year}`;
  }
  return null;
}

/**
 * Rebuild businessKey from a persisted row (hydrate / legacy exports).
 * @param {object} row
 * @returns {string | null}
 */
export function inferBusinessKeyFromRow(row) {
  if (row.businessKey) {
    return row.businessKey;
  }
  if (row.year == null) {
    return null;
  }
  const monthIndex =
    typeof row.monthIndex === 'number'
      ? row.monthIndex
      : typeof row.month === 'number'
        ? row.month - 1
        : null;

  if (MONTHLY_IDEMPOTENT_TYPES.has(row.type) && monthIndex != null) {
    return `${row.type}:${row.year}:${monthIndex}`;
  }
  if (YEARLY_IDEMPOTENT_TYPES.has(row.type)) {
    return `${row.type}:${row.year}`;
  }
  return null;
}
