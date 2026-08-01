const PDF_EXCLUDED_TYPES = new Set([
  'cumul_maintenance',
  'cumul_construction',
  'cumul_salary',
  'cumul_exceptional_expenses',
  'cumul_loan_interest',
  'cumul_loan_repayment',
  'balance',
]);

/** @param {object} entry */
export function isJournalIncomeType(entry) {
  return (
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
    entry.type === 'capital_funds' ||
    entry.type === 'loan_capital' ||
    entry.type.startsWith('export_') ||
    (entry.type === 'carry_forward' && entry.description?.includes('(+)'))
  );
}

/** @param {Array<object>} entries */
export function filterJournalEntriesForPdfExport(entries) {
  return entries.filter((entry) => !PDF_EXCLUDED_TYPES.has(entry.type));
}
