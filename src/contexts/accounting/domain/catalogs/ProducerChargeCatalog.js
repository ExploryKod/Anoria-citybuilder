/**
 * The charges a producer of goods bears, and who pays the building upkeep. Declared once, here. The cost of the goods a
 * building sells is what it buys from its suppliers (its purchases), so it has no charge of its own on its sales.
 *
 * - `WAGE_FACTOR_BY_SKILL_LEVEL`: the wage grid. A worker's monthly gross wage is the city's reference salary (the
 *   `salaryPerMonth` rate of the hamlet, the one the unemployment benefit and the income tax brackets are set on) times the factor of the skill
 *   level its workplace requires. So one lever, the reference salary, moves every wage, as a minimum wage would. The payroll follows the
 *   staffing, not the sales (see ProducerChargePolicy.js's payrollOf). A skill level not declared here throws.
 * - `CORPORATE_TAX_RATE`: the corporate tax on a lucrative building's profit (sales − purchases − wages − its own upkeep),
 *   per month. A loss pays nothing and is not carried forward.
 * - `HOUSING_MAINTENANCE_SUBSIDY_PERCENT`: the share of a non-lucrative building's upkeep the city pays (houses, roads,
 *   services): 100 by default.
 * - `COMPANY_MAINTENANCE_SUBSIDY_PERCENT`: the share of a lucrative building's upkeep the city pays: 0 by default, the
 *   building pays its own.
 */
export const CORPORATE_TAX_RATE = 0.25;

/** @type {Readonly<Record<number, number>>} skill level → factor of the reference salary (first values, to tune with a play-through) */
export const WAGE_FACTOR_BY_SKILL_LEVEL = Object.freeze({ 1: 1, 2: 1.4, 3: 1.9 });

export const HOUSING_MAINTENANCE_SUBSIDY_PERCENT = 100;
export const COMPANY_MAINTENANCE_SUBSIDY_PERCENT = 0;
