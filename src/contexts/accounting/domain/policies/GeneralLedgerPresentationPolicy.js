/**
 * Domain policy — journal entry type filters for the general ledger UI.
 */

/**
 * @param {{ type: string }} entry
 * @param {string[]} types
 */
export function ledgerEntryMatchesTypeFilter(entry, types) {
  return types.some((filterType) => {
    if (entry.type === filterType) {
      return true;
    }
    if (filterType.endsWith('_') && entry.type.startsWith(filterType)) {
      return true;
    }
    return false;
  });
}

/**
 * @param {Array<{ type: string }>} entries
 * @param {string[]|null|undefined} types
 */
export function filterLedgerEntriesByTypes(entries, types) {
  if (!types || types.length === 0) {
    return entries;
  }
  return entries.filter((entry) => ledgerEntryMatchesTypeFilter(entry, types));
}

/**
 * @param {Array<object>} incomeEntries
 * @param {Array<object>} expenseEntries
 */
export function orderGeneralLedgerEntries(incomeEntries, expenseEntries) {
  const carryForwardIncome = incomeEntries.filter((e) => e.type === 'carry_forward');
  const carryForwardExpenses = expenseEntries.filter((e) => e.type === 'carry_forward');
  const otherIncome = incomeEntries.filter((e) => e.type !== 'carry_forward');
  const otherExpenses = expenseEntries.filter((e) => e.type !== 'carry_forward');

  return [
    ...carryForwardIncome,
    ...carryForwardExpenses,
    ...otherIncome,
    ...otherExpenses,
  ];
}
