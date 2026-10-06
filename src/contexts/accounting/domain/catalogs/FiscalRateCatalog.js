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
  salaryTaxThreshold: 0,
  unemploymentBenefitRate: 0.7,
});

/** @type {Readonly<Record<keyof typeof DEFAULT_HAMLET_FISCAL_RATES, { min: number, max: number, integer: boolean }>>} */
export const HAMLET_FISCAL_RATE_BOUNDS = Object.freeze({
  citizenTaxPerCapita: Object.freeze({ min: 0, max: 1000, integer: true }),
  salaryPerMonth: Object.freeze({ min: 10, max: 500, integer: true }),
  salaryTaxRate: Object.freeze({ min: 0, max: 1, integer: false }),
  salaryTaxThreshold: Object.freeze({ min: 0, max: 500, integer: true }),
  unemploymentBenefitRate: Object.freeze({ min: 0, max: 1, integer: false }),
});

/** A service's subsidy, in whole percent of its price: 0 = the inhabitants pay all of it. */
export const DEFAULT_SERVICE_SUBSIDY_PERCENT = 0;
export const SERVICE_SUBSIDY_BOUNDS = Object.freeze({ min: 0, max: 100, integer: true });

/**
 * A VAT category's rate, in whole percent of the price excluding tax (HT): 0 = no VAT on its goods. The uniform switch
 * puts every category at the general rate.
 */
export const DEFAULT_VAT_RATE_PERCENT = 0;
export const DEFAULT_VAT_GENERAL_RATE_PERCENT = 0;
export const DEFAULT_VAT_UNIFORM = false;
export const VAT_RATE_BOUNDS = Object.freeze({ min: 0, max: 50, integer: true });

/** The city's customs rate, as a fraction of the sale (0.15 = 15 %). */
export const CUSTOMS_RATE_BOUNDS = Object.freeze({ min: 0, max: 0.5 });

/**
 * The range of every fiscal slider the admin panels show, in the unit the slider shows (percent for a rate).
 * The panels take their min and max from here; nothing else declares a range.
 */
export function fiscalSliderBounds() {
  const inPercent = (bounds) => ({ min: Math.round(bounds.min * 100), max: Math.round(bounds.max * 100) });
  return Object.freeze({
    citizenTaxPerCapita: HAMLET_FISCAL_RATE_BOUNDS.citizenTaxPerCapita,
    salaryPerMonth: HAMLET_FISCAL_RATE_BOUNDS.salaryPerMonth,
    salaryTaxThreshold: HAMLET_FISCAL_RATE_BOUNDS.salaryTaxThreshold,
    salaryTaxPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.salaryTaxRate),
    unemploymentBenefitPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.unemploymentBenefitRate),
    serviceSubsidyPercent: SERVICE_SUBSIDY_BOUNDS,
    customsPercent: inPercent(CUSTOMS_RATE_BOUNDS),
    vatPercent: VAT_RATE_BOUNDS,
  });
}
