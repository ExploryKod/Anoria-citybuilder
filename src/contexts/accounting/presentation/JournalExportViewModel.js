/** @param {object} entry */
export function journalEntryTypeLabel(entry) {
  const typeLabels = {
    citizen_tax: 'Impôt Citoyen',
    payroll_tax: 'Impôt sur les salaires (assiette citoyens)',
    capital_funds: 'Capital',
    loan_capital: 'Capital Prêt',
    construction: 'Construction',
    maintenance: 'Maintenance',
    salary: 'Salaires fonctionnaires',
    unemployment_benefit: 'Salaires chômeurs',
    exceptional_expenses: 'Réparation',
    import_wheat: 'Import Blé',
    import_carrot: 'Import Carotte',
    import_cabbage: 'Import Chou',
    import_wood: 'Import Bois',
    export_wheat: 'Export Blé',
    export_carrot: 'Export Carotte',
    export_cabbage: 'Export Chou',
    export_wood: 'Export Bois',
    loan_interest: 'Intérêts',
    loan_repayment: 'Remboursement',
    carry_forward: 'Report',
  };

  return typeLabels[entry.type] || entry.type;
}

/**
 * @param {object} params
 * @param {Array<object>} params.entries
 * @param {Array<object>} params.yearlySummary
 * @param {Array<object>} params.yearEndBalances
 */
export function buildJournalExportPayload({ entries, yearlySummary, yearEndBalances }) {
  return {
    exportDate: new Date().toISOString(),
    entries: entries.map((entry) => ({
      id: entry.id,
      turn: entry.turn,
      date: entry.date,
      type: entry.type,
      amount: entry.amount,
      description: entry.description,
    })),
    yearlySummary: yearlySummary.map((year) => ({
      year: year.year,
      income: year.income.total,
      expenses: year.expenses.total,
      netFlow: year.netFlow,
      monthCount: year.monthCount,
    })),
    yearEndBalances,
  };
}

/** @param {ReturnType<typeof buildJournalExportPayload>} payload */
export function serializeJournalExportPayload(payload) {
  return JSON.stringify(payload, null, 2);
}
