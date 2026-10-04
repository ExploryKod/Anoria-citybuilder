/**
 * The rates a hamlet sets for its own budget: the citizen tax, the civil servants' salary and the taxes on it.
 * Declared here once: the defaults are written on a hamlet when it is created, the bounds are what the admin
 * panel accepts. Customs are not here: they are one rate for the whole city (see the trade relations).
 */

/** @type {Readonly<{ citizenTaxPerCapita: number, salaryPerMonth: number, salaryTaxRate: number, unemploymentBenefitRate: number }>} */
export const DEFAULT_HAMLET_FISCAL_RATES = Object.freeze({
  citizenTaxPerCapita: 25,
  salaryPerMonth: 100,
  salaryTaxRate: 0.1,
  unemploymentBenefitRate: 0.7,
});

/** @type {Readonly<Record<keyof typeof DEFAULT_HAMLET_FISCAL_RATES, { min: number, max: number, integer: boolean }>>} */
export const HAMLET_FISCAL_RATE_BOUNDS = Object.freeze({
  citizenTaxPerCapita: Object.freeze({ min: 0, max: 1000, integer: true }),
  salaryPerMonth: Object.freeze({ min: 10, max: 500, integer: true }),
  salaryTaxRate: Object.freeze({ min: 0, max: 1, integer: false }),
  unemploymentBenefitRate: Object.freeze({ min: 0, max: 1, integer: false }),
});

/** A service's subsidy, in whole percent of its price: 0 = the inhabitants pay all of it. */
export const DEFAULT_SERVICE_SUBSIDY_PERCENT = 0;
export const SERVICE_SUBSIDY_BOUNDS = Object.freeze({ min: 0, max: 100, integer: true });

/** A good's value-added tax, in whole percent of its price excluding tax (HT): 0 = no VAT on that good. */
export const DEFAULT_VAT_RATE_PERCENT = 0;
export const VAT_RATE_BOUNDS = Object.freeze({ min: 0, max: 50, integer: true });
