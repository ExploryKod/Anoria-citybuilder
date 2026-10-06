/**
 * The simplified analytical account of one building, read from its own journal lines. Every figure is a sum of the lines
 * on its account (`accountBuildingId`) stamped with the period (year, and month when given): the journal is the only
 * record, so nothing here is stored. Sums are in centimes, so the figures are exact.
 *
 * A company's account: sales HT (goods and services), purchases HT, the gross margin (sales − purchases), the city's subsidy
 * it received, its workers' wages and its upkeep, the operating result, its corporate tax, and the net result. A house
 * pays for the services it receives, and its account receives its workers' wages: its result is what is left of them.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';

const toCentimes = (amount) => Math.round(amount * 100);
const fromCentimes = (centimes) => centimes / 100;

/**
 * @param {Array<{ type: string, amount: number, year: number, month: number, accountBuildingId: string | null, accountKind?: string | null }>} entries the journal lines
 * @param {string} buildingId
 * @param {{ year: number, month?: number, accountKind?: string | null }} period a month (1 to 12) of a year, or the whole year when month is not given; accountKind picks a house's account
 * @returns {{ revenueHT: number, purchasesHT: number, grossMargin: number, subsidiesReceived: number, wages: number, upkeep: number, operatingResult: number, corporateTax: number, netResult: number, wagesReceived: number, servicesPaid: number, goodsBought: number, householdResult: number }}
 */
export function buildingFinanceFigures(entries, buildingId, { year, month = null, accountKind = null }) {
  if (!buildingId) throw new Error('[finance] a building account needs its building');
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const byType = new Map();
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey || entry.year !== year) continue;
    if (month !== null && entry.month !== month) continue;
    byType.set(entry.type, (byType.get(entry.type) ?? 0) + toCentimes(entry.amount));
  }
  const of = (type) => byType.get(type) ?? 0;

  const revenue = of('producer_revenue') + of('service_sales');
  const grossMargin = revenue - of('producer_purchase');
  const operatingResult = grossMargin + of('service_subsidy_received') - of('producer_wage') - of('maintenance');
  const netResult = operatingResult - of('corporate_tax');
  const householdResult = of('household_wage') - of('service_purchase') - of('consumer_purchase');

  return {
    revenueHT: fromCentimes(revenue),
    purchasesHT: fromCentimes(of('producer_purchase')),
    grossMargin: fromCentimes(grossMargin),
    subsidiesReceived: fromCentimes(of('service_subsidy_received')),
    wages: fromCentimes(of('producer_wage')),
    upkeep: fromCentimes(of('maintenance')),
    operatingResult: fromCentimes(operatingResult),
    corporateTax: fromCentimes(of('corporate_tax')),
    netResult: fromCentimes(netResult),
    wagesReceived: fromCentimes(of('household_wage')),
    servicesPaid: fromCentimes(of('service_purchase')),
    goodsBought: fromCentimes(of('consumer_purchase')),
    householdResult: fromCentimes(householdResult),
  };
}

/**
 * The monthly budget of a house's personal account, read from the month's own lines. A house buys during the month with
 * what it has: its carried savings, the salary of the month before (settled on the first day) and the services of that
 * month (settled the same day), less what it has already bought. Nothing is stored: the carried savings are what the
 * balance was before the month's lines, so the budget is derived from the balance and the lines.
 *
 * @param {Array<{ type: string, amount: number, year: number, month: number, accountBuildingId: string | null, accountKind?: string | null }>} entries
 * @param {string} houseId
 * @param {{ year: number, month: number, balance: number }} period the month (1 to 12) and the account's balance now
 * @returns {{ carried: number, wages: number, services: number, purchases: number, budget: number, saved: number }}
 *   carried: the savings brought forward; budget: what the house can spend this month; saved: what it keeps at the end
 */
export function householdBudgetOf(entries, houseId, { year, month, balance }) {
  if (!houseId) throw new Error('[budget] a household budget needs its house');
  const accountKey = accountKeyOf({ accountBuildingId: houseId, accountKind: 'particulier' });
  let wages = 0;
  let services = 0;
  let purchases = 0;
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey || entry.year !== year || entry.month !== month) continue;
    const amount = toCentimes(entry.amount);
    if (entry.type === 'household_wage') wages += amount;
    else if (entry.type === 'service_purchase') services += amount;
    else if (entry.type === 'consumer_purchase') purchases += amount;
    else throw new Error(`[budget] a personal account holds a "${entry.type}" line, which the household budget does not know`);
  }
  const saved = toCentimes(balance);
  const carried = saved - wages + services + purchases;
  return {
    carried: fromCentimes(carried),
    wages: fromCentimes(wages),
    services: fromCentimes(services),
    purchases: fromCentimes(purchases),
    budget: fromCentimes(carried + wages - services),
    saved: fromCentimes(saved),
  };
}

/**
 * A house's last month, as the table shows it. Its salary and services are settled on the first day of the month after
 * the activity, so they are read from the settlement month; its goods are paid at each delivery, so they are read from the
 * month they were bought in. Both are the activity of the month before the current one.
 *
 * @param {Array<object>} entries the journal lines
 * @param {string} houseId
 * @param {{ settled: { year: number, month: number }, bought: { year: number, month: number } }} months
 * @returns {{ wagesReceived: number, servicesPaid: number, goodsBought: number, householdResult: number }}
 */
export function householdLastMonthOf(entries, houseId, { settled, bought }) {
  const settledFigures = buildingFinanceFigures(entries, houseId, { ...settled, accountKind: 'particulier' });
  const boughtFigures = buildingFinanceFigures(entries, houseId, { ...bought, accountKind: 'particulier' });
  return {
    wagesReceived: settledFigures.wagesReceived,
    servicesPaid: settledFigures.servicesPaid,
    goodsBought: boughtFigures.goodsBought,
    householdResult: fromCentimes(
      toCentimes(settledFigures.wagesReceived) - toCentimes(settledFigures.servicesPaid) - toCentimes(boughtFigures.goodsBought),
    ),
  };
}
