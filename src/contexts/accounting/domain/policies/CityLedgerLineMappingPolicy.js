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
 * @returns {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines}
 */
export function cityLedgerYearLinesFromJournalSummary(
  journalYearSummary,
  balanceForYear
) {
  if (
    !journalYearSummary ||
    !journalYearSummary.income ||
    !journalYearSummary.expenses
  ) {
    return createEmptyCityLedgerYearLines(journalYearSummary?.year ?? 0);
  }

  const incomeEntries = journalYearSummary.income.entries || [];
  const expenseEntries = journalYearSummary.expenses.entries || [];

  const sumByType = (entries, predicate) =>
    entries.filter(predicate).reduce((sum, entry) => sum + entry.amount, 0);

  const initialFunds = sumByType(incomeEntries, (e) => e.type === 'capital_funds');
  const incomeTax = sumByType(incomeEntries, (e) => e.type === 'citizen_tax');
  const payrollTax = sumByType(incomeEntries, (e) => e.type === 'payroll_tax');
  const exports = sumByType(
    incomeEntries,
    (e) => e.type && e.type.startsWith('export_')
  );
  const loanCapital = sumByType(incomeEntries, (e) => e.type === 'loan_capital');
  const carryForwardIncome = sumByType(
    incomeEntries,
    (e) => e.type === 'carry_forward'
  );

  const construction = sumByType(expenseEntries, (e) => e.type === 'construction');
  const maintenance = sumByType(expenseEntries, (e) => e.type === 'maintenance');
  const salary = sumByType(expenseEntries, (e) => e.type === 'salary');
  const unemploymentBenefit = sumByType(
    expenseEntries,
    (e) => e.type === 'unemployment_benefit'
  );
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
  const loanInterest = sumByType(expenseEntries, (e) => e.type === 'loan_interest');
  const loanRepayment = sumByType(
    expenseEntries,
    (e) => e.type === 'loan_repayment'
  );
  const carryForwardExpense = sumByType(
    expenseEntries,
    (e) => e.type === 'carry_forward'
  );

  const totalIncome =
    initialFunds + incomeTax + payrollTax + exports + loanCapital;
  const totalExpenses =
    construction +
    maintenance +
    salary +
    unemploymentBenefit +
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
    exports: Math.round(exports),
    loanCapital: Math.round(loanCapital),
    carryForwardIncome: Math.round(carryForwardIncome),
    totalIncome: Math.round(totalIncome),
    construction: Math.round(construction),
    maintenance: Math.round(maintenance),
    salary: Math.round(salary),
    unemploymentBenefit: Math.round(unemploymentBenefit),
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
