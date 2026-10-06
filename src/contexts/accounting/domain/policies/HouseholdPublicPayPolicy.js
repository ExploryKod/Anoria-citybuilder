import { computeCivilServantCount } from './ReferenceSalaryPayrollPolicy.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * The public pay and the unemployment benefit a household (foyer) receives in a month. Its residents are split between
 * civil servants (the city's employees: one per twelve residents, the rule of the city), workers (employed in a workplace)
 * and the unemployed (the rest). The city pays the civil servants the reference salary, and the unemployed a benefit: the
 * household receives both on its personal account.
 *
 * @param {{ pop: number, workers: number, referenceSalaryPerMonth: number, unemploymentBenefitRate: number }} params
 *   pop: the household's residents; workers: those of them employed in a workplace this month; the rate is a fraction
 * @returns {{ civilServants: number, unemployed: number, publicPay: number, benefit: number }}
 */
export function householdPublicPayOf({ pop, workers, referenceSalaryPerMonth, unemploymentBenefitRate }) {
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[pay] a household's residents must be a count, got ${pop}`);
  if (!Number.isInteger(workers) || workers < 0) throw new Error(`[pay] a household's workers must be a count, got ${workers}`);
  const civilServants = computeCivilServantCount(pop);
  const unemployed = Math.max(0, pop - civilServants - workers);
  return {
    civilServants,
    unemployed,
    publicPay: centimes(civilServants * referenceSalaryPerMonth),
    benefit: centimes(unemployed * referenceSalaryPerMonth * unemploymentBenefitRate),
  };
}
