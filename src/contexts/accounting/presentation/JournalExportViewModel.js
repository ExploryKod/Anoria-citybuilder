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
    commercial_route: 'Commission Négociants',
    contribution: 'Contribution',
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
  };

  return typeLabels[entry.type] || entry.type;
}

/**
 * @param {object} params
 * @param {Array<object>} params.entries
 * @param {Array<object>} params.yearlySummary
 */
export function buildJournalExportPayload({ entries, yearlySummary }) {
  return {
    exportDate: new Date().toISOString(),
    // Every stored field, unchanged (year/month stamp, hamletId, businessKey, partnerId, buildingInstanceId…):
    // the export is the audit trail, so it must not drop anything the journal holds.
    entries: entries.map((entry) => ({ ...entry })),
    yearlySummary: yearlySummary.map((year) => ({
      year: year.year,
      income: year.income.total,
      expenses: year.expenses.total,
      netFlow: year.netFlow,
      monthCount: year.monthCount,
    })),
  };
}

/** @param {ReturnType<typeof buildJournalExportPayload>} payload */
export function serializeJournalExportPayload(payload) {
  return JSON.stringify(payload, null, 2);
}
