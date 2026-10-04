import { isInfoPseudoMovementType } from './LedgerInformativeTypePolicy.js';

/** Legacy info types (renamed to `info_*`). */
const LEGACY_INFO_PSEUDO_MOVEMENT_TYPES = new Set([
  'loan_default_interest',
  'loan_default_repayment',
]);

/** @param {string} type */
export function isInformativeJournalType(type) {
  if (isInfoPseudoMovementType(type) || LEGACY_INFO_PSEUDO_MOVEMENT_TYPES.has(type)) {
    return true;
  }

  return false;
}

/**
 * Monthly summary classification (includes loan_capital as income).
 *
 * @param {object} entry
 * @param {Array<object>} allEntries
 * @param {(turn: number) => { year: number, monthIndex?: number }} getTimeInfo
 */
export function isJournalEntryIncomeForMonthlySummary(entry, allEntries, getTimeInfo) {
  let isIncome =
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
    entry.type === 'vat' ||
    entry.type === 'capital_funds' ||
    entry.type === 'loan_capital';

  if (entry.type.startsWith('import_')) {
    isIncome = false;
  }

  if (entry.type.startsWith('export_')) {
    isIncome = true;
  }

  if (entry.type === 'loan_interest' || entry.type === 'loan_repayment') {
    isIncome = false;
  }

  if (
    entry.type === 'construction' ||
    entry.type === 'construction_refund' ||
    entry.type === 'maintenance' ||
    entry.type === 'salary' ||
    entry.type === 'unemployment_benefit' ||
    entry.type === 'exceptional_expenses' ||
    entry.type === 'commercial_route' ||
    entry.type === 'contribution'
  ) {
    isIncome = false;
  }


  return isIncome;
}
