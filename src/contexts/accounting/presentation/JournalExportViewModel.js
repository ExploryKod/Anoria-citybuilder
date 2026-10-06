/** @param {object} entry */
export function journalEntryTypeLabel(entry) {
  const typeLabels = {
    citizen_tax: 'Impôt Citoyen',
    payroll_tax: 'Impôt sur le revenu (IR)',
    vat: 'TVA ventes',
    producer_revenue: 'Ventes HT',
    producer_purchase: 'Achats HT',
    producer_wage: 'Salaires des ouvriers',
    household_wage: 'Salaire perçu',
    corporate_tax: 'Impôt sur les sociétés',
    corporate_tax_revenue: 'Impôt sur les sociétés perçu',
    subsidy_companies: 'Subvention entretien entreprise',
    subsidy_housing: 'Subvention entretien habitation',
    capital_funds: 'Capital',
    loan_capital: 'Capital Prêt',
    construction: 'Construction',
    maintenance: 'Maintenance',
    salary: 'Salaires fonctionnaires',
    unemployment_benefit: 'Salaires chômeurs',
    service_subsidy: 'Subventions des services',
    service_sales: 'Ventes de services',
    consumer_purchase: 'Achats des maisons',
    income_tax: 'Impôt sur le revenu retenu',
    public_wage: 'Salaire de fonctionnaire perçu',
    household_benefit: 'Allocation chômage perçue',
    service_purchase: 'Achats de services',
    service_subsidy_received: 'Subvention reçue',
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
