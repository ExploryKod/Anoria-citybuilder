/**
 * @deprecated Prefer ReferenceSalaryPayrollPolicy — kept for import stability.
 */
export {
  CITIZENS_PER_CIVIL_SERVANT,
  computeCivilServantCount,
  computeReferenceSalaryPayrollBreakdown as computeCivilServantPayrollBreakdown,
  formatCivilServantSalaryJournalDescription,
  formatPayrollTaxJournalDescription,
  formatUnemploymentBenefitJournalDescription,
} from './ReferenceSalaryPayrollPolicy.js';

import {
  computeReferenceSalaryPayrollBreakdown,
} from './ReferenceSalaryPayrollPolicy.js';

/** @deprecated Use computeReferenceSalaryPayrollBreakdown().payrollTaxBase */
export function computeCitizenPayrollTaxBase(
  population,
  salaryPerMonth,
  unemployed = 0,
  unemploymentBenefitRate = 0.5
) {
  return computeReferenceSalaryPayrollBreakdown({
    population,
    unemployed,
    referenceSalaryPerMonth: salaryPerMonth,
    unemploymentBenefitRate,
    salaryTaxRate: 0,
  }).payrollTaxBase;
}

/** @deprecated Use computeReferenceSalaryPayrollBreakdown().civilServantExpense */
export function computeCivilServantSalaryExpense(population, salaryPerMonth) {
  return computeReferenceSalaryPayrollBreakdown({
    population,
    unemployed: 0,
    referenceSalaryPerMonth: salaryPerMonth,
    unemploymentBenefitRate: 0,
    salaryTaxRate: 0,
  }).civilServantExpense;
}

/** @deprecated Use computeReferenceSalaryPayrollBreakdown().payrollTax */
export function computePayrollTaxAmount(payrollTaxBase, salaryTaxRate) {
  return Math.round(payrollTaxBase * salaryTaxRate);
}
