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
 * Chronological order within a month (game turn, then persisted id, then insertion order).
 *
 * @param {object} a
 * @param {object} b
 */
export function compareJournalEntriesInMonth(a, b) {
  const turnA = a.turn ?? 0;
  const turnB = b.turn ?? 0;
  if (turnA !== turnB) {
    return turnA - turnB;
  }

  const idA = a.id ?? Number.MAX_SAFE_INTEGER;
  const idB = b.id ?? Number.MAX_SAFE_INTEGER;
  if (idA !== idB) {
    return idA - idB;
  }

  // Neither is persisted yet: the insertion order (a stable sort) decides.
  return 0;
}

/**
 * @param {Array<object>} incomeEntries
 * @param {Array<object>} expenseEntries
 */
export function orderGeneralLedgerEntries(incomeEntries, expenseEntries) {
  return [...incomeEntries, ...expenseEntries].sort(compareJournalEntriesInMonth);
}
