/**
 * @deprecated Prefer ReferenceSalaryPayrollPolicy — kept for import stability.
 */
export {
  computeReferenceSalaryPayrollBreakdown,
  formatUnemploymentBenefitJournalDescription,
} from './ReferenceSalaryPayrollPolicy.js';

import { computeReferenceSalaryPayrollBreakdown } from './ReferenceSalaryPayrollPolicy.js';

/** @deprecated Use computeReferenceSalaryPayrollBreakdown().unemploymentBenefitExpense */
export function computeUnemploymentBenefitAmount({
  unemployed,
  salaryPerMonth,
  benefitRate,
  population = Number.MAX_SAFE_INTEGER,
}) {
  return computeReferenceSalaryPayrollBreakdown({
    population,
    unemployed,
    referenceSalaryPerMonth: salaryPerMonth,
    unemploymentBenefitRate: benefitRate,
    salaryTaxRate: 0,
  }).unemploymentBenefitExpense;
}
