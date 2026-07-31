/**
 * Naming policy — journal lines that look like income/expense but do NOT move treasury.
 *
 * Convention:
 * - `type`: `info_{sourceType}` (e.g. `info_loan_interest`)
 * - `businessKey`: `info:{sourceType}:{entityId}:{turn}`
 * - UI label: explicit « informatif » (+ nature impayée le cas échéant)
 * - `description`: prefixed with `[Informatif]`
 */

/** Prefix for pseudo-movement journal types (no treasury). */
export const INFO_JOURNAL_TYPE_PREFIX = 'info_';

/** Prefix for idempotence keys of pseudo-movements. */
export const INFO_BUSINESS_KEY_PREFIX = 'info';

const INFO_SOURCE_TYPES = new Set(['loan_interest', 'loan_repayment']);

/** @param {string} type */
export function isInfoPseudoMovementType(type) {
  return typeof type === 'string' && type.startsWith(INFO_JOURNAL_TYPE_PREFIX);
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @returns {string}
 */
export function infoJournalTypeFor(sourceType) {
  return `${INFO_JOURNAL_TYPE_PREFIX}${sourceType}`;
}

/**
 * @param {string} infoType — e.g. `info_loan_interest`
 * @returns {string|null}
 */
export function sourceTypeFromInfoJournalType(infoType) {
  if (!isInfoPseudoMovementType(infoType)) {
    return null;
  }
  const source = infoType.slice(INFO_JOURNAL_TYPE_PREFIX.length);
  return INFO_SOURCE_TYPES.has(source) ? source : source;
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @param {string} entityId
 * @param {number} turn
 * @returns {string|null}
 */
export function buildInfoMovementBusinessKey(sourceType, entityId, turn) {
  if (!INFO_SOURCE_TYPES.has(sourceType)) {
    return null;
  }
  if (!entityId || typeof turn !== 'number' || Number.isNaN(turn)) {
    return null;
  }
  return `${INFO_BUSINESS_KEY_PREFIX}:${sourceType}:${entityId}:${turn}`;
}

/** Display labels keyed by info journal type. */
export const INFO_JOURNAL_TYPE_LABELS = {
  info_loan_interest: 'Intérêts prêt (informatif — impayé)',
  info_loan_repayment: 'Capital prêt (informatif — impayé)',
};

/**
 * @param {string} infoType
 * @returns {string}
 */
export function labelForInfoJournalType(infoType) {
  return INFO_JOURNAL_TYPE_LABELS[infoType] ?? `[Informatif] ${infoType}`;
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @param {string} detail — free text after the dash
 * @returns {string}
 */
export function formatInfoMovementDescription(sourceType, detail) {
  const head =
    sourceType === 'loan_interest'
      ? 'Intérêts prêt'
      : sourceType === 'loan_repayment'
        ? 'Capital prêt'
        : sourceType;
  return `[Informatif] ${head} — ${detail}`;
}
