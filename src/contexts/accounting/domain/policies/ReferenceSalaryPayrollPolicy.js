/** One civil servant per this many citizens (employed or unemployed). */
export const CITIZENS_PER_CIVIL_SERVANT = 12;

/**
 * @param {number} population
 * @returns {number}
 */
export function computeCivilServantCount(population) {
  if (!population || population <= 0) {
    return 0;
  }
  return Math.floor(population / CITIZENS_PER_CIVIL_SERVANT);
}

/**
 * Monthly payroll breakdown from the internal reference salary.
 *
 * - Fonctionnaires : ref × 100 % × nb (1 / 12 hab.) — charge ville
 * - Chômeurs       : ref × taux × nb chômeurs — charge ville
 * - Citoyens actifs: ref × 100 % × nb (pool ouvrier − fonctionnaires − chômeurs) — informatif, assiette impôt
 *
 * @param {{
 *   population: number,
 *   unemployed: number,
 *   eliteCount?: number,
 *   referenceSalaryPerMonth: number,
 *   unemploymentBenefitRate: number,
 *   salaryTaxRate: number,
 * }} params
 * @returns {{
 *   referenceSalaryPerMonth: number,
 *   civilServantCount: number,
 *   unemployedCount: number,
 *   citizenCount: number,
 *   civilServantPayrollMass: number,
 *   unemploymentPayrollMass: number,
 *   citizenPayrollMass: number,
 *   payrollTaxBase: number,
 *   civilServantExpense: number,
 *   unemploymentBenefitExpense: number,
 *   payrollTax: number,
 *   cityExpenseTotal: number,
 * }}
 */
export function computeReferenceSalaryPayrollBreakdown({
  population,
  unemployed,
  eliteCount = 0,
  referenceSalaryPerMonth,
  unemploymentBenefitRate,
  salaryTaxRate,
}) {
  const ref = referenceSalaryPerMonth;
  const civilServantCount = computeCivilServantCount(population);
  const elites = Math.max(0, eliteCount ?? 0);
  const laborPool = Math.max(0, population - civilServantCount - elites);
  const unemployedCount = Math.max(0, Math.min(unemployed ?? 0, laborPool));
  const citizenCount = Math.max(0, laborPool - unemployedCount);

  const civilServantPayrollMass = Math.round(civilServantCount * ref);
  const unemploymentPayrollMass = Math.round(unemployedCount * ref * unemploymentBenefitRate);
  const citizenPayrollMass = Math.round(citizenCount * ref);

  const payrollTaxBase =
    civilServantPayrollMass + unemploymentPayrollMass + citizenPayrollMass;
  const payrollTax =
    salaryTaxRate > 0 ? Math.round(payrollTaxBase * salaryTaxRate) : 0;

  return {
    referenceSalaryPerMonth: ref,
    unemploymentBenefitRate,
    civilServantCount,
    unemployedCount,
    citizenCount,
    civilServantPayrollMass,
    unemploymentPayrollMass,
    citizenPayrollMass,
    payrollTaxBase,
    civilServantExpense: civilServantPayrollMass,
    unemploymentBenefitExpense: unemploymentPayrollMass,
    payrollTax,
    cityExpenseTotal: civilServantPayrollMass + unemploymentPayrollMass,
  };
}

/**
 * @param {{ monthName: string, yearDisplay: string, civilServantCount: number, referenceSalaryPerMonth: number }} params
 * @returns {string}
 */
export function formatCivilServantSalaryJournalDescription({
  monthName,
  yearDisplay,
  civilServantCount,
  referenceSalaryPerMonth,
}) {
  return `Salaires fonctionnaires - ${monthName} ${yearDisplay} (${civilServantCount} fonct. × ${referenceSalaryPerMonth}€)`;
}

/**
 * @param {{
 *   monthName: string,
 *   yearDisplay: string,
 *   unemployedCount: number,
 *   referenceSalaryPerMonth: number,
 *   unemploymentBenefitRate: number,
 * }} params
 * @returns {string}
 */
export function formatUnemploymentBenefitJournalDescription({
  monthName,
  yearDisplay,
  unemployedCount,
  referenceSalaryPerMonth,
  unemploymentBenefitRate,
}) {
  const ratePercent = Math.round(unemploymentBenefitRate * 100);
  return `Salaires chômeurs - ${monthName} ${yearDisplay} (${unemployedCount} chôm. × ${referenceSalaryPerMonth}€ × ${ratePercent}%)`;
}

/**
 * @param {{
 *   monthName: string,
 *   yearDisplay: string,
 *   salaryTaxRate: number,
 *   breakdown: ReturnType<typeof computeReferenceSalaryPayrollBreakdown>,
 * }} params
 * @returns {string}
 */
export function formatPayrollTaxJournalDescription({
  monthName,
  yearDisplay,
  salaryTaxRate,
  breakdown,
}) {
  const ratePercent = Math.round(salaryTaxRate * 100);
  const {
    civilServantCount,
    unemployedCount,
    citizenCount,
    referenceSalaryPerMonth,
    unemploymentBenefitRate,
    payrollTaxBase,
  } = breakdown;
  const unemploymentPercent = Math.round(unemploymentBenefitRate * 100);
  const assiette = [
    civilServantCount > 0
      ? `${civilServantCount} fonct.×${referenceSalaryPerMonth}€`
      : null,
    citizenCount > 0 ? `${citizenCount} citoy.×${referenceSalaryPerMonth}€` : null,
    unemployedCount > 0
      ? `${unemployedCount} chôm.×${referenceSalaryPerMonth}€×${unemploymentPercent}%`
      : null,
  ]
    .filter(Boolean)
    .join(' + ');

  return `Impôt sur les salaires - ${monthName} ${yearDisplay} (${ratePercent}%, assiette ${payrollTaxBase}€ : ${assiette})`;
}
