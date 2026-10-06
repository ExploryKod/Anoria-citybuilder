import { PERSONAL_ACCOUNT } from './AccountKeyPolicy.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { resolveBuildingKind, BUILDING_KIND_HOUSE } from '../../../../shared/building-identity/index.js';
import {
  COMPANY_MAINTENANCE_SUBSIDY_PERCENT,
  CORPORATE_TAX_RATE,
  HOUSING_MAINTENANCE_SUBSIDY_PERCENT,
  WAGE_RATE_BY_ROLE,
} from '../catalogs/ProducerChargeCatalog.js';

/**
 * A lucrative building is a private company: it produces, is a hub, or sells goods or services to the houses. A house is
 * never lucrative, whatever it produces: its upkeep is the city's. A service is a company like the others, its sales are
 * the houses' share of the price (see serviceSaleLines).
 * @param {string} type
 * @returns {boolean}
 */
export function isLucrativeBuilding(type) {
  if (resolveBuildingKind(type) === BUILDING_KIND_HOUSE) return false;
  return getResourceRoles(type).some((entry) => entry.role === 'producer' || entry.role === 'hub' || entry.role === 'distributor');
}

/**
 * The workers' wage rate of a lucrative building type: the first role, in WAGE_RATE_BY_ROLE's order, the type holds.
 * @param {string} type
 * @returns {number}
 */
export function wageRateOfBuilding(type) {
  const roles = getResourceRoles(type).map((entry) => entry.role);
  const role = ['producer', 'hub', 'distributor'].find((candidate) => roles.includes(candidate));
  if (!role) throw new Error(`[producer] "${type}" is lucrative but holds no producer, hub or goods seller role: it has no wage rate`);
  return WAGE_RATE_BY_ROLE[role];
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
 * The wages a lucrative building pays for one month: its rate on its sales, when it has workers. A building without workers
 * pays none; a building that is not lucrative pays none (its workers are not paid by a company).
 * @param {{ type: string, salesHT: number, workers: number }} workplace
 * @returns {number}
 */
export function wagesPaidOf({ type, salesHT, workers }) {
  if (!isLucrativeBuilding(type) || workers <= 0) return 0;
  return centimes(salesHT * wageRateOfBuilding(type));
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
 * The building lines of one month: a lucrative building pays its wages (`wagesHT`, paid to its workers' houses by the
 * settlement), its upkeep less the company subsidy, and its corporate tax on the profit that is left (sales + subsidies
 * received − purchases − wages − its own upkeep). A non-lucrative building has no account: its upkeep is the city's, as the housing subsidy.
 * A line of zero is not written.
 * @param {{ id: string, type: string, salesHT: number, subsidiesHT: number, purchasesHT: number, wagesHT: number, maintenanceCost: number }} building
 * @returns {ChargeLine[]}
 */
export function buildingChargeLines({ id, type, salesHT, subsidiesHT, purchasesHT, wagesHT, maintenanceCost }) {
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
    const profit = centimes(salesHT + subsidiesHT - purchasesHT - wagesHT - ownUpkeep);
    const tax = profit > 0 ? centimes(profit * CORPORATE_TAX_RATE) : 0;
    add('maintenance', ownUpkeep, id);
    add('subsidy_companies', subsidy, null);
    add('corporate_tax', tax, id);
    add('corporate_tax_revenue', tax, null);
  } else {
    add('maintenance', ownUpkeep, null);
    add('subsidy_housing', subsidy, null);
  }
  return lines;
}

/**
 * The income tax (IR) withheld on a house's wage. Only the part of the wage above the monthly threshold is taxed, at the
 * rate: a wage under the threshold pays nothing. The tax is rounded to the centime, so the gross is exactly the net plus
 * the tax.
 * @param {{ gross: number, rate: number, threshold: number }} params rate as a fraction (0.1 is 10 %), threshold in euros a month
 * @returns {{ gross: number, incomeTax: number, net: number }}
 */
export function withholdIncomeTax({ gross, rate, threshold }) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error(`[tax] the income tax rate must be a fraction, got ${rate}`);
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error(`[tax] the income tax threshold must be an amount, got ${threshold}`);
  const grossC = centimes(gross);
  const taxable = Math.max(0, grossC - threshold);
  const incomeTax = centimes(taxable * rate);
  return { gross: grossC, incomeTax, net: centimes(grossC - incomeTax) };
}
