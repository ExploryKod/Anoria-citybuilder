import { goodLabel } from '../../../presentation/dom/shell/CatalogVocabulary.js';

/** @param {object} entry */
/**
 * The words of the trade lines, by journal type prefix. Imports and exports are told apart everywhere: the merchants' own
 * lines (what they bought and sold, the duty they paid, the freight) and the city's (the duty it received, one per flow).
 * `import_` is what our merchants paid a foreign city; `export_` is the city's income from the export duty.
 */
export const TRADE_LINE_WORDS = Object.freeze([
  ['import_', 'Import'],
  ['freight_', 'Transport'],
  ['duty_paid_import_', 'Douane import payée'],
  ['customs_import_', 'Douane import perçue'],
  ['abroad_sale_', 'Vente export'],
  ['duty_paid_export_', 'Douane export payée'],
  ['export_', 'Douane export perçue'],
]);

/**
 * @param {string} type A journal type
 * @returns {string | null} e.g. "Import Charbon", or null when the type is not a trade line
 */
export function tradeLineLabel(type) {
  for (const [prefix, word] of TRADE_LINE_WORDS) {
    if (type.startsWith(prefix)) return `${word} ${goodLabel(type.slice(prefix.length))}`;
  }
  return null;
}

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
    citizen_tax_paid: 'Impôt Citoyen retenu',
    public_wage: 'Salaire de fonctionnaire perçu',
    household_benefit: 'Allocation chômage perçue',
    service_purchase: 'Achats de services',
    service_subsidy_received: 'Subvention reçue',
    subsidy_companies_received: 'Subvention entretien reçue',
    employer_contribution: 'Cotisations patronales',
    employee_contribution: 'Cotisations salariales',
    social_contribution: 'Cotisations sociales perçues',
    cooperative_participation: 'Participation aux résultats versée',
    cooperative_dividend: 'Dividendes versés',
    household_participation: 'Participation aux résultats perçue',
    household_dividend: 'Dividendes perçus',
    exceptional_expenses: 'Réparation',
    commercial_route: 'Commission Négociants',
    contribution: 'Contribution',
    loan_interest: 'Intérêts',
    loan_repayment: 'Remboursement',
  };

  // A trade line is named after what it is and after its good, as the catalog names it ("Import Charbon").
  const traded = tradeLineLabel(entry.type);
  if (traded) return traded;

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
