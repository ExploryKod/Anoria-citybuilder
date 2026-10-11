/** @param {object} entry */
export function isJournalIncomeType(entry) {
  return (
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
    entry.type === 'vat' ||
    entry.type === 'producer_revenue' ||
    entry.type === 'corporate_tax_revenue' ||
    entry.type === 'social_contribution' ||
    entry.type === 'household_participation' ||
    entry.type === 'household_dividend' ||
    entry.type === 'capital_funds' ||
    entry.type === 'loan_capital' ||
    entry.type.startsWith('export_') ||
    entry.type.startsWith('customs_import_') ||
    entry.type.startsWith('abroad_sale_')
  );
}
