/**
 * The charges a producer of goods bears, and who pays the building upkeep. Declared once, here. The cost of the goods a
 * building sells is what it buys from its suppliers (its purchases), so it has no charge of its own on its sales.
 *
 * - The wages are not declared here: the labour market settles one wage per skill and level (LabourMarketCatalog.js, WageRatePolicy.js),
 *   never under the city's minimum wage. The payroll of a building is its staffed workers times the wage of its workplace's skill and
 *   level: it follows the staffing, not the sales (see ProducerChargePolicy.js's payrollOf).
 * - The corporate tax on a lucrative building's profit (sales − purchases − wages − its own upkeep) is a rate the player sets
 *   (`corporateTaxRate`, see FiscalRateCatalog.js). A loss pays nothing and is not carried forward.
 * - `HOUSING_MAINTENANCE_SUBSIDY_PERCENT`: the share of the upkeep of a non-lucrative building that is not a house (roads, services)
 *   the city pays: all of it. A house's upkeep is a charge of its household, subsidised at a rate the player sets
 *   (`houseMaintenanceSubsidyRate`, see FiscalRateCatalog.js).
 * - `COMPANY_MAINTENANCE_SUBSIDY_PERCENT`: the share of a lucrative building's upkeep the city pays: 0 by default, the
 *   building pays its own.
 * - How the enterprise of a house shares its result (a cooperative, a property company) is the rule of its legal form: see
 *   shared/accounting-catalog/LegalFormCatalog.js.
 */

export const HOUSING_MAINTENANCE_SUBSIDY_PERCENT = 100;
export const COMPANY_MAINTENANCE_SUBSIDY_PERCENT = 0;
