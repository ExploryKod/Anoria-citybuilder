import {
  createCityLedgerYearLines,
  createEmptyCityLedgerYearLines,
} from '../value-objects/CityLedgerYearLines.js';

/**
 * Domain policy — journal yearly summary → city-ledger line amounts.
 * Rules unchanged from legacy finances-section mapping.
 *
 * @param {object|null|undefined} journalYearSummary
 * @param {number} balanceForYear
 * @param {number} previousNetFlow the year before's net flow: it is carried into this year (a gain on the income
 *   side, a loss on the expense side). It is not added to the totals: the year's totals are its own flows.
 * @returns {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines}
 */
export function cityLedgerYearLinesFromJournalSummary(
  journalYearSummary,
  balanceForYear,
  previousNetFlow
) {
  if (
    !journalYearSummary ||
    !journalYearSummary.income ||
    !journalYearSummary.expenses
  ) {
    return createEmptyCityLedgerYearLines(journalYearSummary?.year ?? 0);
  }

  // The city's ledger holds the city's own account: a company's sales, purchases and profit are its own (see
  // ProducerChargePolicy), so they are not in it.
  const cityOnly = (entry) => (entry.accountBuildingId ?? null) === null;
  const incomeEntries = (journalYearSummary.income.entries || []).filter(cityOnly);
  const expenseEntries = (journalYearSummary.expenses.entries || []).filter(cityOnly);

  const sumByType = (entries, predicate) =>
    entries.filter(predicate).reduce((sum, entry) => sum + entry.amount, 0);

  const initialFunds = sumByType(incomeEntries, (e) => e.type === 'capital_funds');
  const incomeTax = sumByType(incomeEntries, (e) => e.type === 'citizen_tax');
  const payrollTax = sumByType(incomeEntries, (e) => e.type === 'payroll_tax');
  const vat = sumByType(incomeEntries, (e) => e.type === 'vat');
  const exports = sumByType(
    incomeEntries,
    (e) => e.type && e.type.startsWith('export_')
  );
  const loanCapital = sumByType(incomeEntries, (e) => e.type === 'loan_capital');
  const carryForwardIncome = previousNetFlow >= 0 ? previousNetFlow : 0;

  const construction = sumByType(expenseEntries, (e) => e.type === 'construction');
  const maintenance = sumByType(expenseEntries, (e) => e.type === 'maintenance');
  const salary = sumByType(expenseEntries, (e) => e.type === 'salary');
  const unemploymentBenefit = sumByType(
    expenseEntries,
    (e) => e.type === 'unemployment_benefit'
  );
  const serviceSubsidy = sumByType(expenseEntries, (e) => e.type === 'service_subsidy');
  const repairs = sumByType(expenseEntries, (e) => e.type === 'exceptional_expenses');
  const commercialRoutes = sumByType(
    expenseEntries,
    (e) => e.type === 'commercial_route'
  );
  const contributions = sumByType(expenseEntries, (e) => e.type === 'contribution');
  const imports = sumByType(
    expenseEntries,
    (e) => e.type && e.type.startsWith('import_')
  );
  const corporateTaxRevenue = sumByType(incomeEntries, (e) => e.type === 'corporate_tax_revenue');
  const companySubsidy = sumByType(expenseEntries, (e) => e.type === 'subsidy_companies');
  const housingSubsidy = sumByType(expenseEntries, (e) => e.type === 'subsidy_housing');
  const loanInterest = sumByType(expenseEntries, (e) => e.type === 'loan_interest');
  const loanRepayment = sumByType(
    expenseEntries,
    (e) => e.type === 'loan_repayment'
  );
  const carryForwardExpense = previousNetFlow < 0 ? -previousNetFlow : 0;

  const totalIncome =
    initialFunds + incomeTax + payrollTax + vat + corporateTaxRevenue + exports + loanCapital;
  const totalExpenses =
    construction +
    maintenance +
    salary +
    unemploymentBenefit +
    serviceSubsidy +
    companySubsidy +
    housingSubsidy +
    repairs +
    commercialRoutes +
    contributions +
    imports +
    loanInterest +
    loanRepayment;

  return createCityLedgerYearLines({
    year: journalYearSummary.year,
    initialFunds: Math.round(initialFunds),
    incomeTax: Math.round(incomeTax),
    payrollTax: Math.round(payrollTax),
    vat: Math.round(vat),
    exports: Math.round(exports),
    loanCapital: Math.round(loanCapital),
    carryForwardIncome: Math.round(carryForwardIncome),
    totalIncome: Math.round(totalIncome),
    construction: Math.round(construction),
    maintenance: Math.round(maintenance),
    salary: Math.round(salary),
    unemploymentBenefit: Math.round(unemploymentBenefit),
    serviceSubsidy: Math.round(serviceSubsidy),
    corporateTaxRevenue: Math.round(corporateTaxRevenue),
    companySubsidy: Math.round(companySubsidy),
    housingSubsidy: Math.round(housingSubsidy),
    repairs: Math.round(repairs),
    commercialRoutes: Math.round(commercialRoutes),
    contributions: Math.round(contributions),
    imports: Math.round(imports),
    loanInterest: Math.round(loanInterest),
    loanRepayment: Math.round(loanRepayment),
    carryForwardExpense: Math.round(carryForwardExpense),
    totalExpenses: Math.round(totalExpenses),
    balance: Math.round(balanceForYear),
  });
}
