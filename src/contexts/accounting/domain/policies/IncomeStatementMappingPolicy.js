import { createIncomeStatement } from '../read-models/IncomeStatement.js';

/**
 * @param {number} amount
 * @param {Record<string, number>} bucket
 * @param {string} key
 */
function addToBucket(amount, bucket, key) {
  bucket[key] = Math.round((bucket[key] ?? 0) + amount);
}

/**
 * Build income statement lines from journal partition (yearly or cumulative).
 *
 * @param {number} labelYearOrTurn — fiscal year label, or turn when cumulative
 * @param {{ income: { entries: Array<{type: string, amount: number}> }, expenses: { entries: Array<{type: string, amount: number}> } }} partition
 * @param {{ cumulativeAtTurn?: number|null }} [options]
 */
export function incomeStatementFromJournalPartition(labelYearOrTurn, partition, options = {}) {
  const productBuckets = {
    citizenTax: 0,
    payrollTax: 0,
    exports: 0,
    loanCapital: 0,
    constructionRefund: 0,
    other: 0,
  };

  const chargeBuckets = {
    salaries: 0,
    unemploymentBenefits: 0,
    maintenance: 0,
    construction: 0,
    loanInterest: 0,
    loanRepayment: 0,
    imports: 0,
    exceptional: 0,
    commercialRoute: 0,
    other: 0,
  };

  for (const entry of partition.income?.entries ?? []) {
    const amount = Math.round(entry.amount ?? 0);
    if (entry.type === 'citizen_tax') addToBucket(amount, productBuckets, 'citizenTax');
    else if (entry.type === 'payroll_tax') addToBucket(amount, productBuckets, 'payrollTax');
    else if (entry.type === 'loan_capital') addToBucket(amount, productBuckets, 'loanCapital');
    else if (entry.type === 'construction_refund') {
      addToBucket(amount, productBuckets, 'constructionRefund');
    } else if (entry.type.startsWith('export_')) addToBucket(amount, productBuckets, 'exports');
    else if (entry.type === 'capital_funds') {
      /* operating CR excludes initial capital */
    } else addToBucket(amount, productBuckets, 'other');
  }

  for (const entry of partition.expenses?.entries ?? []) {
    const amount = Math.round(entry.amount ?? 0);
    if (entry.type === 'salary') addToBucket(amount, chargeBuckets, 'salaries');
    else if (entry.type === 'unemployment_benefit') {
      addToBucket(amount, chargeBuckets, 'unemploymentBenefits');
    } else if (entry.type === 'maintenance') addToBucket(amount, chargeBuckets, 'maintenance');
    else if (entry.type === 'construction') addToBucket(amount, chargeBuckets, 'construction');
    else if (entry.type === 'loan_interest') addToBucket(amount, chargeBuckets, 'loanInterest');
    else if (entry.type === 'loan_repayment') addToBucket(amount, chargeBuckets, 'loanRepayment');
    else if (entry.type.startsWith('import_')) addToBucket(amount, chargeBuckets, 'imports');
    else if (entry.type === 'exceptional_expenses') {
      addToBucket(amount, chargeBuckets, 'exceptional');
    } else if (entry.type === 'commercial_route') {
      addToBucket(amount, chargeBuckets, 'commercialRoute');
    } else addToBucket(amount, chargeBuckets, 'other');
  }

  const products = [
    { label: 'Impôt citoyen', amount: productBuckets.citizenTax },
    { label: 'Impôt sur les salaires', amount: productBuckets.payrollTax },
    { label: 'Exports commerce', amount: productBuckets.exports },
    { label: 'Tirages de prêts', amount: productBuckets.loanCapital },
    { label: 'Remboursements construction', amount: productBuckets.constructionRefund },
    { label: 'Autres produits', amount: productBuckets.other },
  ].filter((line) => line.amount > 0);

  const charges = [
    { label: 'Salaires fonctionnaires', amount: chargeBuckets.salaries },
    { label: 'Salaires chômeurs', amount: chargeBuckets.unemploymentBenefits },
    { label: 'Maintenance', amount: chargeBuckets.maintenance },
    { label: 'Construction', amount: chargeBuckets.construction },
    { label: 'Intérêts de prêts', amount: chargeBuckets.loanInterest },
    { label: 'Remboursements prêts', amount: chargeBuckets.loanRepayment },
    { label: 'Imports commerce', amount: chargeBuckets.imports },
    { label: 'Dépenses exceptionnelles', amount: chargeBuckets.exceptional },
    { label: 'Routes commerciales', amount: chargeBuckets.commercialRoute },
    { label: 'Autres charges', amount: chargeBuckets.other },
  ].filter((line) => line.amount > 0);

  return createIncomeStatement({
    fiscalYear: labelYearOrTurn,
    products,
    charges,
    cumulativeAtTurn: options.cumulativeAtTurn ?? null,
  });
}

/** @deprecated Use incomeStatementFromJournalPartition */
export function incomeStatementFromYearSummary(fiscalYear, yearSummary) {
  return incomeStatementFromJournalPartition(fiscalYear, yearSummary);
}
