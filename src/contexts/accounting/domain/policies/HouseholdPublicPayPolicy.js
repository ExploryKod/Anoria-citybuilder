const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * The unemployment benefit a household (foyer) receives in a month. Its residents are split between workers
 * (employed in a workplace this month) and the unemployed (the rest) — civil servants were removed from this
 * split (2026-10-10, "suppress it for now"): a resident is either a worker or unemployed, nothing in between.
 * The city pays the unemployed a benefit, a fraction of the reference salary; the household receives it on
 * its personal account.
 *
 * @param {{ pop: number, workers: number, referenceSalaryPerMonth: number, unemploymentBenefitRate: number }} params
 *   pop: the household's residents; workers: those of them employed in a workplace this month; the rate is a fraction
 * @returns {{ unemployed: number, benefit: number }}
 */
export function householdPublicPayOf({ pop, workers, referenceSalaryPerMonth, unemploymentBenefitRate }) {
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[pay] a household's residents must be a count, got ${pop}`);
  if (!Number.isInteger(workers) || workers < 0) throw new Error(`[pay] a household's workers must be a count, got ${workers}`);
  const unemployed = Math.max(0, pop - workers);
  return {
    unemployed,
    benefit: centimes(unemployed * referenceSalaryPerMonth * unemploymentBenefitRate),
  };
}
