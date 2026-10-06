/** @param {object} entry */
export function isJournalIncomeType(entry) {
  return (
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
    entry.type === 'vat' ||
    entry.type === 'producer_revenue' ||
    entry.type === 'corporate_tax_revenue' ||
    entry.type === 'capital_funds' ||
    entry.type === 'loan_capital' ||
    entry.type.startsWith('export_')
  );
}
