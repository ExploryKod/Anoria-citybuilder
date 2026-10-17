/**
 * The rates a hamlet sets for its own budget: the citizen tax, the minimum wage (the floor of every wage, when the hamlet has one: see
 * `MINIMUM_WAGE_MODES`) and the taxes on wages. The unemployment benefit is a share of the lowest wage the city pays (see `benefitBaseOf`). The wages themselves are not set here: the labour market settles them.
 * Declared here once: the defaults are written on a hamlet when it is created, the bounds are what the admin
 * panel accepts. Customs are not here: they are one rate for the whole city (see the trade relations).
 */

/**
 * The income tax (IR) is progressive, fixed at three bands: exempt below `salaryTaxThreshold1`, `salaryTaxRate1` on the
 * part between the two thresholds, `salaryTaxRate2` on the part above `salaryTaxThreshold2` (see withholdIncomeTax).
 * @type {Readonly<{ citizenTaxPerCapita: number, minimumWage: number, minimumWageBasketRatio: number, salaryTaxThreshold1: number, salaryTaxRate1: number, salaryTaxThreshold2: number, salaryTaxRate2: number, unemploymentBenefitRate: number, employerContributionRate: number, employeeContributionRate: number, rentPerHouse: number, administratorStipend: number, corporateTaxRate: number }>}
 */
export const DEFAULT_HAMLET_FISCAL_RATES = Object.freeze({
  citizenTaxPerCapita: 25,
  // The economy's own scale: a citizen's needs cost about 5.8 a month, a first wage is 8 (see LabourMarketCatalog.js). The brackets are per
  // household (foyer): a household with three workers earns about 24.
  minimumWage: 6,
  // In `indexed` mode, the floor is this many times the cost of living (a citizen's month): 1.5 is a floor a half above what a citizen needs.
  minimumWageBasketRatio: 1.5,
  salaryTaxThreshold1: 10,
  salaryTaxRate1: 0.1,
  salaryTaxThreshold2: 30,
  salaryTaxRate2: 0.2,
  unemploymentBenefitRate: 0.7,
  // The social contributions, a share of the gross wage: the employer's (a charge of the company, 645) and the employee's (withheld from the
  // wage). Both go to the city's social security, which pays the unemployment benefit.
  employerContributionRate: 0.25,
  employeeContributionRate: 0.1,
  // The rent every house but the mayor's pays each month, to the mayor's house (the owner): very low to begin with (a citizen's needs cost about
  // 5.8 a month), whole euros. An unpaid rent becomes a debt the house settles when it has the money.
  rentPerHouse: 1,
  // What the city pays each administrator a month (the mayor's house): the player's choice, apart from the minimum wage. It starts at a first wage (see
  // START_WAGE_BY_SKILL_LEVEL), so the mayor's house can pay its needs from the first month; too low, its services are cut and its tiers (so its skills) stay out of reach.
  administratorStipend: 8,
  // The corporate tax (IS) on a company's profit of the year, and on a cooperative's surplus: a quarter, as it was before the player could set it.
  corporateTaxRate: 0.25,
});

/**
 * How a hamlet treats the minimum wage, the first lever of its economic regime:
 * - `none`: no floor at all, the labour market alone sets every wage (very liberal);
 * - `fixed`: a floor in euros a month that stays where the player set it (`minimumWage`), as in the US;
 * - `indexed`: a floor that follows the cost of living, as in France: every January it is revalued to `minimumWageBasketRatio` times what a
 *   citizen's month costs (see CostOfLivingPolicy.js), and the revalued amount is the floor (`minimumWage`) until the next January. When the cost
 *   of living is not known (a good nobody sells) the floor stays where it was.
 * It is a text, not a rate: it lives apart from `DEFAULT_HAMLET_FISCAL_RATES`, whose fields are all numbers.
 */
export const MINIMUM_WAGE_MODES = Object.freeze(['none', 'fixed', 'indexed']);
export const DEFAULT_MINIMUM_WAGE_MODE = 'fixed';

/** @type {Readonly<Record<keyof typeof DEFAULT_HAMLET_FISCAL_RATES, { min: number, max: number, integer: boolean }>>} */
export const HAMLET_FISCAL_RATE_BOUNDS = Object.freeze({
  citizenTaxPerCapita: Object.freeze({ min: 0, max: 1000, integer: true }),
  // Not whole euros: an indexed floor is revalued to the centime.
  minimumWage: Object.freeze({ min: 0.1, max: 60, integer: false }),
  minimumWageBasketRatio: Object.freeze({ min: 0.5, max: 5, integer: false }),
  salaryTaxThreshold1: Object.freeze({ min: 0, max: 500, integer: true }),
  salaryTaxRate1: Object.freeze({ min: 0, max: 1, integer: false }),
  salaryTaxThreshold2: Object.freeze({ min: 0, max: 1000, integer: true }),
  salaryTaxRate2: Object.freeze({ min: 0, max: 1, integer: false }),
  unemploymentBenefitRate: Object.freeze({ min: 0, max: 1, integer: false }),
  employerContributionRate: Object.freeze({ min: 0, max: 0.6, integer: false }),
  employeeContributionRate: Object.freeze({ min: 0, max: 0.4, integer: false }),
  rentPerHouse: Object.freeze({ min: 0, max: 20, integer: true }),
  administratorStipend: Object.freeze({ min: 0, max: 100, integer: true }),
  corporateTaxRate: Object.freeze({ min: 0, max: 0.6, integer: false }),
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
    minimumWage: Object.freeze({ min: Math.ceil(HAMLET_FISCAL_RATE_BOUNDS.minimumWage.min), max: HAMLET_FISCAL_RATE_BOUNDS.minimumWage.max }),
    minimumWageBasketPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.minimumWageBasketRatio),
    salaryTaxThreshold1: HAMLET_FISCAL_RATE_BOUNDS.salaryTaxThreshold1,
    salaryTaxPercent1: inPercent(HAMLET_FISCAL_RATE_BOUNDS.salaryTaxRate1),
    salaryTaxThreshold2: HAMLET_FISCAL_RATE_BOUNDS.salaryTaxThreshold2,
    salaryTaxPercent2: inPercent(HAMLET_FISCAL_RATE_BOUNDS.salaryTaxRate2),
    unemploymentBenefitPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.unemploymentBenefitRate),
    employerContributionPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.employerContributionRate),
    employeeContributionPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.employeeContributionRate),
    rentPerHouse: HAMLET_FISCAL_RATE_BOUNDS.rentPerHouse,
    administratorStipend: HAMLET_FISCAL_RATE_BOUNDS.administratorStipend,
    corporateTaxPercent: inPercent(HAMLET_FISCAL_RATE_BOUNDS.corporateTaxRate),
    serviceSubsidyPercent: SERVICE_SUBSIDY_BOUNDS,
    customsPercent: inPercent(CUSTOMS_RATE_BOUNDS),
    vatPercent: VAT_RATE_BOUNDS,
  });
}
