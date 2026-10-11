/**
 * The charges a producer of goods bears, and who pays the building upkeep. Declared once, here. The cost of the goods a
 * building sells is what it buys from its suppliers (its purchases), so it has no charge of its own on its sales.
 *
 * - The wages are not declared here: the labour market settles one wage per skill and level (LabourMarketCatalog.js, WageRatePolicy.js),
 *   never under the city's minimum wage. The payroll of a building is its staffed workers times the wage of its workplace's skill and
 *   level: it follows the staffing, not the sales (see ProducerChargePolicy.js's payrollOf).
 * - `CORPORATE_TAX_RATE`: the corporate tax on a lucrative building's profit (sales − purchases − wages − its own upkeep),
 *   per month. A loss pays nothing and is not carried forward.
 * - `HOUSING_MAINTENANCE_SUBSIDY_PERCENT`: the share of a non-lucrative building's upkeep the city pays (houses, roads,
 *   services): 100 by default.
 * - `COMPANY_MAINTENANCE_SUBSIDY_PERCENT`: the share of a lucrative building's upkeep the city pays: 0 by default, the
 *   building pays its own.
 */
export const CORPORATE_TAX_RATE = 0.25;

/**
 * A house's own business is a cooperative (SCOP): its residents are its workers and its associates. Each month's surplus (what it sells less
 * what it buys) is shared in three parts, as the French rules of the SCOP ask (entreprendre.service-public.gouv.fr/vosdroits/F31328):
 * - `workers` (part salarié, "participation"): at least 25 %, paid to the residents, a charge before the tax on profits (PCG 691);
 * - `associates` (part associé, interest on the parts sociales): paid to the residents after the tax, lower than both other parts (PCG 457);
 * - `enterprise` (part entreprise): the legal reserve (at least 15 %) and the development fund (at least 1 %) and the other reserves, which stay in
 *   the business and are never shared out. The tax on profits is paid out of it.
 * The three add up to one. The usual shares are 40 / 15 / 45.
 */
export const COOPERATIVE_SHARES = Object.freeze({ workers: 0.4, associates: 0.15, enterprise: 0.45 });
/** The least the rules ask of each part (a fraction of the surplus). */
export const COOPERATIVE_MINIMUM_SHARES = Object.freeze({ workers: 0.25, enterprise: 0.16 });

export const HOUSING_MAINTENANCE_SUBSIDY_PERCENT = 100;
export const COMPANY_MAINTENANCE_SUBSIDY_PERCENT = 0;
