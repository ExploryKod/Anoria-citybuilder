import { isInfoPseudoMovementType } from './LedgerInformativeTypePolicy.js';
import { isOperationDiverse } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

/** Legacy info types (renamed to `info_*`). */
const LEGACY_INFO_PSEUDO_MOVEMENT_TYPES = new Set([
  'loan_default_interest',
  'loan_default_repayment',
]);

/**
 * A line that moves no money: an informative one, or an opération diverse (the month's closing: variation of stock, depreciation). Neither is
 * a flow of the treasury, of the monthly summaries or of the city's ledger.
 * @param {string} type
 */
export function isInformativeJournalType(type) {
  if (isInfoPseudoMovementType(type) || LEGACY_INFO_PSEUDO_MOVEMENT_TYPES.has(type) || isOperationDiverse(type)) {
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
    entry.type === 'producer_revenue' ||
    entry.type === 'corporate_tax_revenue' ||
    entry.type === 'corporate_tax_debt_received' ||
    entry.type === 'contribution_debt_received' ||
    entry.type === 'service_sales' ||
    entry.type === 'service_subsidy_received' ||
    entry.type === 'subsidy_companies_received' ||
    entry.type === 'subsidy_housing_received' ||
    entry.type === 'social_contribution' ||
    entry.type === 'household_participation' ||
    entry.type === 'household_dividend' ||
    entry.type === 'income_tax_refund' ||
    entry.type === 'rent_received' ||
    entry.type === 'premises_rent_received' ||
    entry.type === 'premises_rent_debt_received' ||
    entry.type === 'company_capital_received' ||
    entry.type === 'capital_funds' ||
    entry.type === 'loan_capital';

  if (entry.type.startsWith('import_') || entry.type.startsWith('freight_') || entry.type.startsWith('duty_paid_')) {
    isIncome = false;
  }

  if (entry.type.startsWith('customs_import_') || entry.type.startsWith('abroad_sale_')) {
    isIncome = true;
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
