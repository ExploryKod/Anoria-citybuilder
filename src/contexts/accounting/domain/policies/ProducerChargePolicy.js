import { PERSONAL_ACCOUNT } from './AccountKeyPolicy.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { resolveBuildingKind, BUILDING_KIND_HOUSE } from '../../../../shared/building-identity/index.js';
import {
  COMPANY_MAINTENANCE_SUBSIDY_PERCENT,
  CORPORATE_TAX_RATE,
  HOUSING_MAINTENANCE_SUBSIDY_PERCENT,
} from '../catalogs/ProducerChargeCatalog.js';

/** A building with no resourceRole of its own that is still lucrative: today, only the bank (it holds and lends
 * money, not goods — see buildingEconomy.js's 'Bank' entry). Read off its own `employment.requiredSkill`, the
 * one catalog fact a resourceRole-less building still declares. */
function financeSkillOf(type) {
  return getBuildingDefinition(type)?.employment?.requiredSkill === 'finance';
}

/**
 * A lucrative building is a private company: it produces, is a hub, sells goods or services to the houses, or holds
 * and lends money (the bank). A house is never lucrative, whatever it produces: its upkeep is the city's. A service
 * is a company like the others, its sales are the houses' share of the price (see serviceSaleLines).
 * @param {string} type
 * @returns {boolean}
 */
export function isLucrativeBuilding(type) {
  if (resolveBuildingKind(type) === BUILDING_KIND_HOUSE) return false;
  if (getResourceRoles(type).some((entry) => entry.role === 'producer' || entry.role === 'hub' || entry.role === 'distributor')) return true;
  return financeSkillOf(type);
}

/**
 * The gross wage of one worker of a building for one month: the wage the labour market gives the skill and the level its workplace requires
 * (`employment.requiredSkill`, `requiredSkillLevel`, 1 when it declares none). The market's rate is read through `wageRateOf`.
 * @param {{ type: string, wageRateOf: (skill: string, level: number) => number }} params
 * @returns {number}
 */
export function wagePerWorkerOf({ type, wageRateOf }) {
  const employment = getBuildingDefinition(type)?.employment;
  if (!employment?.requiredSkill) throw new Error(`[producer] "${type}" has workers but its catalog entry declares no required skill: its wage has no labour market`);
  const wage = wageRateOf(employment.requiredSkill, employment.requiredSkillLevel ?? 1);
  if (!(wage > 0)) throw new Error(`[producer] the wage of "${type}"'s workers must be positive, got ${wage}`);
  return centimes(wage);
}

/**
 * The lines of one month, in the journal's words. Two kinds of line:
 * - a trade line moves money between two accounts of the chain (a seller's sale, its buyer's purchase), or between a
 *   company and the houses (a sale): it names its counterparty, so the company's trace shows who paid whom;
 * - a building line moves a company's own money (wages, its upkeep share, its corporate tax) or the city's (the corporate
 *   tax received, the upkeep the city subsidises, a house's upkeep).
 * Every line says whose account it moves: `holder` is the company, null for the city.
 * @typedef {{ kind: string, amount: number, holder: string | null, counterparty: string | null }} ChargeLine
 */

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * The trade lines of one pair of the chain for one month: the seller's sale, and the buyer's purchase when there is a buyer.
 * A sale to the houses has no company buyer: its counterparty is null.
 * @param {{ sellerId: string, buyerId: string | null, amountHT: number }} pair
 * @returns {ChargeLine[]}
 */
export function tradeLines({ sellerId, buyerId, amountHT }) {
  const amount = centimes(amountHT);
  if (amount <= 0) return [];
  const lines = [{ kind: 'producer_revenue', amount, holder: sellerId, counterparty: buyerId }];
  if (buyerId) lines.push({ kind: 'producer_purchase', amount, holder: buyerId, counterparty: sellerId });
  return lines;
}

/**
 * The payroll of a lucrative building for one month: its staffed workers times the wage of its skill level. It follows the staffing, not the
 * sales: a worker is paid whether the building sells or not, so an idle but staffed building shows a loss. A building without workers pays
 * none; a building that is not lucrative pays none (its workers are not paid by a company).
 * @param {{ type: string, workers: number, wageRateOf: (skill: string, level: number) => number }} workplace
 * @returns {number}
 */
export function payrollOf({ type, workers, wageRateOf }) {
  if (!isLucrativeBuilding(type) || workers <= 0) return 0;
  return centimes(workers * wagePerWorkerOf({ type, wageRateOf }));
}

/**
 * The lines of one service a company sold to a house in one month. The house pays the final price (TTC) on its personal
 * account; the company receives it without the VAT (HT); the city receives the VAT, the last buyer being the one who pays
 * it. A fully subsidised service costs the house nothing: no line.
 * @param {{ sellerId: string, buyerId: string, ttc: number, ht: number, vat: number }} sale
 * @returns {ChargeLine[]}
 */
export function serviceSaleLines({ sellerId, buyerId, ttc, ht, vat }) {
  if (centimes(ttc) <= 0) return [];
  return [
    { kind: 'service_purchase', amount: centimes(ttc), holder: buyerId, counterparty: sellerId, accountKind: PERSONAL_ACCOUNT },
    { kind: 'service_sales', amount: centimes(ht), holder: sellerId, counterparty: buyerId },
    { kind: 'vat', amount: centimes(vat), holder: null, counterparty: sellerId },
  ];
}

/**
 * The city's subsidy to one service company for one month: the city pays it (a city line, held by no account) and the
 * company receives it on its own account. Nothing when the subsidy is nil.
 * @param {{ sellerId: string, citySubsidy: number }} subsidy
 * @returns {ChargeLine[]}
 */
export function serviceSubsidyLines({ sellerId, citySubsidy }) {
  const amount = centimes(citySubsidy);
  if (amount <= 0) return [];
  return [
    { kind: 'service_subsidy', amount, holder: null, counterparty: sellerId },
    { kind: 'service_subsidy_received', amount, holder: sellerId, counterparty: null },
  ];
}

/**
 * The wages of one workplace split between the houses its workers come from: each worker is paid the same, so a house
 * receives its workers' share. The company pays it (a producer_wage on its account) and the house receives it (a
 * household_wage on the house's account). The last house takes the centime left over.
 * @param {{ workplaceId: string, wagesHT: number, sources: Record<string, number> }} workplace
 * @returns {ChargeLine[]}
 */
export function wageSplitLines({ workplaceId, wagesHT, sources }) {
  const houses = Object.entries(sources).filter(([, workers]) => workers > 0);
  const totalWorkers = houses.reduce((sum, [, workers]) => sum + workers, 0);
  if (wagesHT <= 0 || totalWorkers === 0) return [];
  const lines = [];
  let paid = 0;
  houses.forEach(([houseId, workers], index) => {
    const amount = index === houses.length - 1 ? centimes(wagesHT - paid) : centimes((wagesHT * workers) / totalWorkers);
    paid = centimes(paid + amount);
    if (amount <= 0) return;
    lines.push({ kind: 'producer_wage', amount, holder: workplaceId, counterparty: houseId });
    lines.push({ kind: 'household_wage', amount, holder: houseId, counterparty: workplaceId, accountKind: PERSONAL_ACCOUNT });
  });
  return lines;
}

/**
 * The employer's social contribution on a month's payroll: a charge of the company (645) and the same amount received by the city's social
 * security, which pays the unemployment benefit.
 * @param {{ workplaceId: string, wagesHT: number, rate: number }} payroll
 * @returns {ChargeLine[]}
 */
export function employerContributionLines({ workplaceId, wagesHT, rate }) {
  const amount = centimes(wagesHT * rate);
  if (amount <= 0) return [];
  return [
    { kind: 'employer_contribution', amount, holder: workplaceId, counterparty: null },
    { kind: 'social_contribution', amount, holder: null, counterparty: workplaceId },
  ];
}

/**
 * The employee's social contribution, withheld from the wages a household received in a month: it leaves the household's personal account and
 * reaches the city's social security.
 * @param {{ houseId: string, wagesReceived: number, rate: number }} receipt
 * @returns {ChargeLine[]}
 */
export function employeeContributionLines({ houseId, wagesReceived, rate }) {
  const amount = centimes(wagesReceived * rate);
  if (amount <= 0) return [];
  return [
    { kind: 'employee_contribution', amount, holder: houseId, counterparty: null, accountKind: PERSONAL_ACCOUNT },
    { kind: 'social_contribution', amount, holder: null, counterparty: houseId },
  ];
}

/**
 * The building lines of one month: a lucrative building pays its wages (`wagesHT`, paid to its workers' houses by the
 * settlement), its upkeep less the company subsidy. A non-lucrative building has no account: its upkeep is the city's, as the
 * housing subsidy. A line of zero is not written. Its corporate tax is not here: it is read off the company's own statement once these
 * lines are written (`corporateTaxDueOf`).
 * @param {{ id: string, type: string, maintenanceCost: number }} building
 * @returns {ChargeLine[]}
 */
export function buildingChargeLines({ id, type, maintenanceCost }) {
  const lucrative = isLucrativeBuilding(type);
  const lines = [];
  const add = (kind, amount, holder) => {
    const rounded = centimes(amount);
    if (rounded > 0) lines.push({ kind, amount: rounded, holder, counterparty: null });
  };

  const subsidyPercent = lucrative ? COMPANY_MAINTENANCE_SUBSIDY_PERCENT : HOUSING_MAINTENANCE_SUBSIDY_PERCENT;
  const subsidy = centimes((maintenanceCost * subsidyPercent) / 100);
  const ownUpkeep = centimes(maintenanceCost - subsidy);

  if (lucrative) {
    // The company books its whole upkeep and, apart, the share the city pays it back: its statement shows what the building really
    // costs and what the city carries. Its cash is the same as paying only the net upkeep.
    add('maintenance', maintenanceCost, id);
    add('subsidy_companies_received', subsidy, id);
    add('subsidy_companies', subsidy, null);
  } else {
    add('maintenance', ownUpkeep, null);
    add('subsidy_housing', subsidy, null);
  }
  return lines;
}

/**
 * The corporate tax a company owes this month: the rate on its résultat courant avant impôts (RCAI) of the year so far, as its compte de
 * résultat shows it, less the tax it already paid this year. The year's total, not the month's: a seasonal company (a harvest once a year)
 * is taxed on what it really earned over the year, and a tax is never more than the rate of the RCAI it is based on, so it cannot turn a
 * profit into a loss. Nothing is refunded: a later loss does not give back a tax already paid.
 * @param {{ rcaiYearToDate: number, taxPaidYearToDate: number }} year
 * @returns {number} the tax to book now (never negative)
 */
export function corporateTaxDueOf({ rcaiYearToDate, taxPaidYearToDate }) {
  const owed = rcaiYearToDate > 0 ? centimes(rcaiYearToDate * CORPORATE_TAX_RATE) : 0;
  return Math.max(0, centimes(owed - taxPaidYearToDate));
}

/**
 * The lines of a company's corporate tax: its charge (695) and the city's receipt. Nothing when the tax is nil.
 * @param {{ id: string, amount: number }} tax
 * @returns {ChargeLine[]}
 */
export function corporateTaxLines({ id, amount }) {
  const rounded = centimes(amount);
  if (rounded <= 0) return [];
  return [
    { kind: 'corporate_tax', amount: rounded, holder: id, counterparty: null },
    { kind: 'corporate_tax_revenue', amount: rounded, holder: null, counterparty: null },
  ];
}

/**
 * The income tax (IR) withheld on a house's wage, progressive over three bands: nothing below `threshold1`, `rate1` on
 * the part between `threshold1` and `threshold2`, `rate2` on the part above `threshold2` — each band taxes only its own
 * slice, never the whole wage at its band's rate. The tax is rounded to the centime, so the gross is exactly the net
 * plus the tax.
 * @param {{ gross: number, threshold1: number, rate1: number, threshold2: number, rate2: number }} params rates as a
 *   fraction (0.1 is 10 %), thresholds in euros a month
 * @returns {{ gross: number, incomeTax: number, net: number }}
 */
export function withholdIncomeTax({ gross, threshold1, rate1, threshold2, rate2 }) {
  if (!Number.isFinite(threshold1) || threshold1 < 0) throw new Error(`[tax] the income tax threshold1 must be an amount, got ${threshold1}`);
  if (!Number.isFinite(threshold2) || threshold2 < threshold1) {
    throw new Error(`[tax] the income tax threshold2 must be an amount at or above threshold1 (${threshold1}), got ${threshold2}`);
  }
  if (!Number.isFinite(rate1) || rate1 < 0 || rate1 > 1) throw new Error(`[tax] the income tax rate1 must be a fraction, got ${rate1}`);
  if (!Number.isFinite(rate2) || rate2 < 0 || rate2 > 1) throw new Error(`[tax] the income tax rate2 must be a fraction, got ${rate2}`);
  const grossC = centimes(gross);
  const band1 = Math.max(0, Math.min(grossC, threshold2) - threshold1);
  const band2 = Math.max(0, grossC - threshold2);
  const incomeTax = centimes(band1 * rate1 + band2 * rate2);
  return { gross: grossC, incomeTax, net: centimes(grossC - incomeTax) };
}
