/**
 * The charges a producer of goods bears, and who pays the building upkeep. Declared once, here. The cost of the goods a
 * building sells is what it buys from its suppliers (its purchases), so it has no charge of its own on its sales.
 *
 * - `WAGE_RATE_BY_ROLE`: the workers' wage, as a fraction of a lucrative building's sales, by the role that makes it
 *   lucrative (a producer, then a hub, then a seller of goods, then the bank's own `finance` skill — see
 *   ProducerChargePolicy.js's wageRateOfBuilding). A building with none of these has no wage.
 * - `CORPORATE_TAX_RATE`: the corporate tax on a lucrative building's profit (sales − purchases − wages − its own upkeep),
 *   per month. A loss pays nothing and is not carried forward.
 * - `HOUSING_MAINTENANCE_SUBSIDY_PERCENT`: the share of a non-lucrative building's upkeep the city pays (houses, roads,
 *   services): 100 by default.
 * - `COMPANY_MAINTENANCE_SUBSIDY_PERCENT`: the share of a lucrative building's upkeep the city pays: 0 by default, the
 *   building pays its own.
 */
export const CORPORATE_TAX_RATE = 0.25;

/** @type {Readonly<Record<'producer' | 'hub' | 'distributor' | 'finance', number>>} */
export const WAGE_RATE_BY_ROLE = Object.freeze({ producer: 0.15, hub: 0.1, distributor: 0.15, finance: 0.1 });

export const HOUSING_MAINTENANCE_SUBSIDY_PERCENT = 100;
export const COMPANY_MAINTENANCE_SUBSIDY_PERCENT = 0;
