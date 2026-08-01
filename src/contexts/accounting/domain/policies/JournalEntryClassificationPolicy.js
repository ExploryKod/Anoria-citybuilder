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

  return (
    type === 'cumul_maintenance' ||
    type === 'cumul_construction' ||
    type === 'cumul_salary' ||
    type === 'cumul_exceptional_expenses' ||
    type === 'cumul_loan_interest' ||
    type === 'cumul_loan_repayment' ||
    type === 'carry_forward' ||
    type === 'balance'
  );
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
    entry.type === 'commercial_route'
  ) {
    isIncome = false;
  }

  if (entry.type === 'carry_forward') {
    const signMatch = entry.description?.match(/\(([+-])\)/);
    if (signMatch) {
      isIncome = signMatch[1] === '+';
    } else {
      const timeInfo = getTimeInfo(entry.turn);
      const previousYear = timeInfo.year - 1;
      if (previousYear >= 0) {
        let prevYearIncome = 0;
        let prevYearExpenses = 0;

        allEntries.forEach((e) => {
          if (e.type === 'carry_forward') return;

          const eTimeInfo = getTimeInfo(e.turn);

          if (eTimeInfo.year === previousYear) {
            let isEIncome =
              e.type === 'citizen_tax' ||
              e.type === 'payroll_tax' ||
              e.type === 'capital_funds' ||
              e.type === 'loan_capital';
            if (e.type.startsWith('import_')) {
              isEIncome = false;
            }
            if (e.type.startsWith('export_')) {
              isEIncome = true;
            }
            if (e.type === 'loan_interest' || e.type === 'loan_repayment') {
              isEIncome = false;
            }
            if (
              e.type === 'construction' ||
              e.type === 'maintenance' ||
              e.type === 'salary' ||
              e.type === 'unemployment_benefit' ||
              e.type === 'exceptional_expenses' ||
              e.type === 'commercial_route'
            ) {
              isEIncome = false;
            }
            if (isEIncome) {
              prevYearIncome += e.amount;
            } else {
              prevYearExpenses += e.amount;
            }
          }
        });

        const prevYearNetFlow = prevYearIncome - prevYearExpenses;
        isIncome = prevYearNetFlow >= 0;
      } else {
        isIncome = true;
      }
    }
  }

  return isIncome;
}
