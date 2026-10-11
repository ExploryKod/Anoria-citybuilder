/**
 * The rates a hamlet sets for its own budget: the citizen tax, the civil servants' salary and the taxes on it.
 * Declared here once: the defaults are written on a hamlet when it is created, the bounds are what the admin
 * panel accepts. Customs are not here: they are one rate for the whole city (see the trade relations).
 */

/**
 * The income tax (IR) is progressive, fixed at three bands: exempt below `salaryTaxThreshold1`, `salaryTaxRate1` on the
 * part between the two thresholds, `salaryTaxRate2` on the part above `salaryTaxThreshold2` (see withholdIncomeTax).
 * @type {Readonly<{ citizenTaxPerCapita: number, salaryPerMonth: number, salaryTaxThreshold1: number, salaryTaxRate1: number, salaryTaxThreshold2: number, salaryTaxRate2: number, unemploymentBenefitRate: number }>}
 */
export const DEFAULT_HAMLET_FISCAL_RATES = Object.freeze({
  citizenTaxPerCapita: 25,
  salaryPerMonth: 100,
  salaryTaxThreshold1: 50,
  salaryTaxRate1: 0.1,
  salaryTaxThreshold2: 150,
  salaryTaxRate2: 0.2,
  unemploymentBenefitRate: 0.7,
});

/** @type {Readonly<Record<keyof typeof DEFAULT_HAMLET_FISCAL_RATES, { min: number, max: number, integer: boolean }>>} */
export const HAMLET_FISCAL_RATE_BOUNDS = Object.freeze({
  citizenTaxPerCapita: Object.freeze({ min: 0, max: 1000, integer: true }),
  salaryPerMonth: Object.freeze({ min: 10, max: 500, integer: true }),
  salaryTaxThreshold1: Object.freeze({ min: 0, max: 500, integer: true }),
  salaryTaxRate1: Object.freeze({ min: 0, max: 1, integer: false }),
  salaryTaxThreshold2: Object.freeze({ min: 0, max: 1000, integer: true }),
  salaryTaxRate2: Object.freeze({ min: 0, max: 1, integer: false }),
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

/**
 * A customs duty, as a fraction of the value of what crosses the border (0.15 = 15 %). One duty per traded good and per
 * flow, set in the customs admin panel: an export duty is paid by the exporter to the city; an import duty by the
 * merchants who import the good, also to the city, on the price plus the transport (not on their own margin). As in the real world, the general default taxes imports lightly and
 * leaves exports free, and a few goods stand apart (an excise on energy, a levy on a raw material that leaves).
 */
export const CUSTOMS_RATE_BOUNDS = Object.freeze({ min: 0, max: 1 });
export const CUSTOMS_FLOWS = Object.freeze(['import', 'export']);
export const DEFAULT_CUSTOMS_DUTY = Object.freeze({ import: 0.1, export: 0 });
/** Goods whose default duty differs from the general one, per flow. */
export const DEFAULT_CUSTOMS_DUTY_BY_GOOD = Object.freeze({
  coal: Object.freeze({ import: 0.2 }),
  petrol: Object.freeze({ import: 0.3 }),
  uranium: Object.freeze({ import: 0.4 }),
  exoticWood: Object.freeze({ import: 0.15 }),
  wood: Object.freeze({ export: 0.15 }),
});

/**
 * @param {'import' | 'export'} flow
 * @param {string} good
 * @returns {number} the duty a city starts with for this good
 */
export function defaultCustomsDuty(flow, good) {
  if (!CUSTOMS_FLOWS.includes(flow)) throw new Error(`[fiscal] unknown customs flow "${flow}"`);
  return DEFAULT_CUSTOMS_DUTY_BY_GOOD[good]?.[flow] ?? DEFAULT_CUSTOMS_DUTY[flow];
}

/**
 * The range of every fiscal slider the admin panels show, in the unit the slider shows (percent for a rate).
 * The panels take their min and max from here; nothing else declares a range.
 */
export function fiscalSliderBounds() {
  const inPercent = (bounds) => ({ min: Math.round(bounds.min * 100), max: Math.round(bounds.max * 100) });
  return Object.freeze({
    citizenTaxPerCapita: HAMLET_FISCAL_RATE_BOUNDS.citizenTaxPerCapita,
    salaryPerMonth: HAMLET_FISCAL_RATE_BOUNDS.salaryPerMonth,
    salaryTaxThreshold1: HAMLET_FISCAL_RATE_BOUNDS.salaryTaxThreshold1,
    salaryTaxPercent1: inPercent(HAMLET_FISCAL_RATE_BOUNDS.salaryTaxRate1),
    salaryTaxThreshold2: HAMLET_FISCAL_RATE_BOUNDS.salaryTaxThreshold2,
    salaryTaxPercent2: inPercent(HAMLET_FISCAL_RATE_BOUNDS.salaryTaxRate2),
    unemploymentBenefitPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.unemploymentBenefitRate),
    serviceSubsidyPercent: SERVICE_SUBSIDY_BOUNDS,
    customsPercent: inPercent(CUSTOMS_RATE_BOUNDS),
    vatPercent: VAT_RATE_BOUNDS,
  });
}
