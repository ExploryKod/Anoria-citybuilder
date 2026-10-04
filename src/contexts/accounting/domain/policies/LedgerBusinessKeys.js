import {
  buildInfoMovementBusinessKey,
  infoJournalTypeFor,
  isInfoPseudoMovementType,
} from './LedgerInformativeTypePolicy.js';

export {
  buildInfoMovementBusinessKey,
  infoJournalTypeFor,
  isInfoPseudoMovementType,
};

/** Types with at most one persisted entry per civil month. */
const MONTHLY_IDEMPOTENT_TYPES = new Set([
  'salary',
  'unemployment_benefit',
  'payroll_tax',
  'maintenance',
]);

/** Types with at most one entry per civil year. */
const YEARLY_IDEMPOTENT_TYPES = new Set(['citizen_tax']);

const LOAN_INSTALLMENT_TYPES = new Set(['loan_interest', 'loan_repayment']);

/**
 * Idempotence key for one loan installment (interest or principal) per game turn.
 * @param {'loan_interest' | 'loan_repayment'} type
 * @param {string} loanId
 * @param {number} turn
 * @returns {string | null}
 */
export function buildLoanInstallmentBusinessKey(type, loanId, turn) {
  if (!LOAN_INSTALLMENT_TYPES.has(type)) {
    return null;
  }
  if (!loanId || typeof turn !== 'number' || Number.isNaN(turn)) {
    return null;
  }
  return `${type}:${loanId}:${turn}`;
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @param {string} loanId
 * @param {number} turn
 * @returns {string | null}
 * @deprecated Renamed — use buildInfoMovementBusinessKey
 */
export function buildLoanDefaultInstallmentBusinessKey(sourceType, loanId, turn) {
  return buildInfoMovementBusinessKey(sourceType, loanId, turn);
}

/**
 * Idempotence key for a single loan capital draw (contract).
 * @param {string} loanId
 * @returns {string | null}
 */
export function buildLoanCapitalBusinessKey(loanId) {
  if (!loanId) {
    return null;
  }
  return `loan_capital:${loanId}`;
}

/**
 * Idempotence key for initial capital journal line (turn 0).
 * @returns {string}
 */
export function buildCapitalFundsBusinessKey() {
  return 'capital_funds:0';
}

/**
 * Idempotence key for one commercial route opening fee per partner.
 * @param {string} partnerId
 * @returns {string | null}
 */
export function buildCommercialRouteBusinessKey(partnerId) {
  if (!partnerId) {
    return null;
  }
  return `commercial_route:${partnerId}`;
}

/**
 * Idempotence key for one contribution payment per news item.
 * @param {string} newsItemId
 * @returns {string | null}
 */
export function buildContributionBusinessKey(newsItemId) {
  if (!newsItemId) {
    return null;
  }
  return `contribution:news:${newsItemId}`;
}




/**
 * @param {string} type
 * @param {{ year: number, monthIndex: number }} timeInfo
 * @returns {string | null}
 */
export function buildLedgerBusinessKey(type, timeInfo, hamletId) {
  if (!timeInfo || typeof timeInfo.year !== 'number') {
    return null;
  }
  if (MONTHLY_IDEMPOTENT_TYPES.has(type)) {
    // A monthly charge is per hamlet: each hamlet pays its own maintenance and salaries for the same month.
    if (!hamletId) {
      throw new Error(`[journal] monthly ${type} needs the hamlet it is charged to`);
    }
    return `${type}:${hamletId}:${timeInfo.year}:${timeInfo.monthIndex}`;
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
    return `${row.type}:${row.hamletId}:${row.year}:${monthIndex}`;
  }
  if (YEARLY_IDEMPOTENT_TYPES.has(row.type)) {
    return `${row.type}:${row.year}`;
  }
  return null;
}
