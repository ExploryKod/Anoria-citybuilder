/**
 * The accounts of one building, read from its own journal lines. The journal is the chronological record of every movement; what is
 * built here is read FROM it for one account over one period, and written nowhere: nothing is stored, and no line is added to the
 * journal for a total or a result.
 *
 * - A COMPANY's (or a house's business) account is read as a COMPTE DE RÉSULTAT in the model of the plan comptable (see
 *   `incomeStatementOf`): only the lines of classes 6 (charges) and 7 (produits) are in it. Capital, loans, construction, bank
 *   deposits and what is due to the State move the cash or the balance sheet, not the result, so they are not in it. The cash of the
 *   account is a different figure (see getTreasurySnapshot), never to be shown as the result.
 * - A house's PERSONAL account is a household budget (a household is not an entity of the plan comptable): the wages and benefits it
 *   receives, the services and goods it pays, its taxes.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { expandYearClosings } from './YearClosingPolicy.js';
import { postingsOf } from './AccountLedgerPolicy.js';
import { isEcriture } from './EntryLegsPolicy.js';
import { INCOME_STATEMENT, goodOfJournalType, isVariableChargeAccount, pcgOfJournalType, statementLineOfAccount } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

const toCentimes = (amount) => Math.round(amount * 100);
const fromCentimes = (centimes) => centimes / 100;

/** The accounts of the commercial margin: the sale of goods, less what the goods cost to bring in (purchase, accessory costs, freight). */
const MARGIN_COST_ACCOUNTS = Object.freeze(['607', '608', '6241']);

/**
 * The compte de résultat of one account over a period, in the model of the plan comptable (INCOME_STATEMENT): the operating income and
 * charges, the operating result, the financial result, the current result before tax, the exceptional result, the tax on profits and the
 * profit or loss. A line of the journal lands in it through its account (PcgJournalCatalog) and only if that account is a charge (class 6)
 * or a product (class 7); a type with no account is not in it, and an account of class 6 or 7 that no line of the statement takes throws.
 *
 * @param {Array<{ type: string, amount: number, year: number, month: number, accountBuildingId: string | null, accountKind?: string | null }>} entries
 * @param {string} buildingId
 * @param {{ year: number, month?: number | null, accountKind?: string | null, salesNature: 'merchandise' | 'production' | 'services' | null }} period
 *   `salesNature`: what the building's sales are (see `salesNatureOf`): goods it resold (707), what it made (701) or services (706);
 *   null when the catalog does not say, which throws as soon as a sale is booked on the account
 */
export function incomeStatementOf(entries, buildingId, { year, month = null, accountKind = null, salesNature }) {
  if (!buildingId) throw new Error('[finance] a compte de résultat needs its building');
  if (salesNature === undefined) throw new Error(`[finance] the compte de résultat of ${buildingId} must be told its sales nature (merchandise, production, services, or null when the catalog gives none)`);
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  // A purged year is read from its closing's totals per type, as its lines would have been (a year view only: they carry no month).
  entries = expandYearClosings(entries);
  const byLine = new Map();
  const byAccount = new Map();
  const byItem = new Map();
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey || entry.year !== year) continue;
    if (month !== null && entry.month !== month) continue;
    if (!isEcriture(entry.type)) continue;
    const pcg = pcgOfJournalType(entry.type);
    if (!pcg || pcg.household) continue;
    // The result is read off the legs the journal booked: a charge (class 6) counts what is debited less what is credited, a product (class 7) the other way
    // round, so a stock that grows (a credit to 6037) lowers the cost of the purchases and a refund lowers what it refunds.
    for (const leg of postingsOf(entry, { salesNature })) {
      const account = leg.account;
      if (account[0] !== '6' && account[0] !== '7') continue;
      if (account === '707' && salesNature === null) throw new Error(`[finance] a sale ("${entry.type}") is booked on ${buildingId}, whose catalog entry does not say whether it sells goods, its production or services`);
      const placed = statementLineOfAccount(account);
      if (!placed) throw new Error(`[finance] the account ${account} of "${entry.type}" has no line in the compte de résultat`);
      const amount = account[0] === '6' ? leg.debit - leg.credit : leg.credit - leg.debit;
      byLine.set(placed.line.id, (byLine.get(placed.line.id) ?? 0) + amount);
      byAccount.set(account, (byAccount.get(account) ?? 0) + amount);
      // What the line is made of: the journal's own kinds of movement, merged when they read the same (an account, a meaning, a good).
      const good = goodOfJournalType(entry.type);
      const itemKey = [account, pcg.label, pcg.detail ?? '', good ?? ''].join('|');
      const items = byItem.get(placed.line.id) ?? new Map();
      const item = items.get(itemKey) ?? { account, label: pcg.label, detail: pcg.detail ?? null, good, tone: pcg.tone, centimes: 0 };
      item.centimes += amount;
      items.set(itemKey, item);
      byItem.set(placed.line.id, items);
    }
  }

  const sections = INCOME_STATEMENT.map((section) => {
    const lines = section.lines.map((line) => ({
      id: line.id,
      label: line.label,
      accounts: line.accounts,
      tone: line.tone,
      amount: fromCentimes(byLine.get(line.id) ?? 0),
      items: [...(byItem.get(line.id)?.values() ?? [])]
        .map(({ centimes, ...item }) => ({ ...item, amount: fromCentimes(centimes) }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    }));
    return { id: section.id, label: section.label, direction: section.direction, lines, total: fromCentimes(section.lines.reduce((sum, line) => sum + (byLine.get(line.id) ?? 0), 0)) };
  });
  const total = (id) => toCentimes(sections.find((section) => section.id === id).total);
  const operating = total('operatingIncome') - total('operatingCharges');
  const financial = total('financialIncome') - total('financialCharges');
  const current = operating + financial;
  const exceptional = total('exceptionalIncome') - total('exceptionalCharges');
  // The cooperative's workers share comes off before the tax on profits, which comes off last.
  const net = current + exceptional - total('workersParticipation') - total('profitTax');
  const sumAccounts = (accounts) => accounts.reduce((sum, account) => sum + (byAccount.get(account) ?? 0), 0);
  const goodsSold = byAccount.get('707') ?? 0;

  return {
    sections,
    results: {
      operating: fromCentimes(operating),
      financial: fromCentimes(financial),
      current: fromCentimes(current),
      exceptional: fromCentimes(exceptional),
      net: fromCentimes(net),
    },
    // The commercial margin: goods sold, less what they cost to bring in. An indicator read off the same accounts, not a line of the statement.
    commercialMargin: fromCentimes(goodsSold - sumAccounts(MARGIN_COST_ACCOUNTS)),
    goodsSold: fromCentimes(goodsSold),
  };
}

/**
 * What an account's cash is made of: every movement of its own journal lines, since it opened, grouped by what it is (an account, a
 * meaning, a good) and signed (money in +, money out −). It explains the cash figure and is not a second balance: no total is
 * made here, the cash itself stays the treasury snapshot's. A closed year is one line (its net).
 * @param {Array<{ type: string, amount: number, accountBuildingId: string | null, accountKind?: string | null, closing?: { net: number } }>} entries
 * @param {string} buildingId
 * @param {{ accountKind?: string | null }} [options]
 * @returns {Array<{ account: string | null, label: string, detail: string | null, good: string | null, tone: string, amount: number }>} the largest movement first
 */
export function cashMovementsOf(entries, buildingId, { accountKind = null } = {}) {
  if (!buildingId) throw new Error('[finance] the cash of an account needs its building');
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const groups = new Map();
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey) continue;
    if (!isEcriture(entry.type)) continue;
    // What moved the cash is the leg on the bank (512): debited is money in, credited is money out. A line with no leg on it (an opération diverse) moved none.
    const cashLeg = postingsOf(entry).find((leg) => leg.account === '512');
    if (!cashLeg) continue;
    const signed = cashLeg.debit - cashLeg.credit;
    let item;
    if (entry.type === 'year_closing') {
      item = { account: null, label: 'Années clôturées (résultat net)', detail: null, good: null, tone: 'treasury' };
    } else {
      const pcg = pcgOfJournalType(entry.type);
      if (!pcg) throw new Error(`[finance] the money line "${entry.type}" has no account in the chart of accounts`);
      item = { account: pcg.account, label: pcg.label, detail: pcg.detail ?? null, good: goodOfJournalType(entry.type), tone: pcg.tone };
    }
    const key = [item.account, item.label, item.detail ?? '', item.good ?? ''].join('|');
    const group = groups.get(key) ?? { ...item, centimes: 0 };
    group.centimes += signed;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ centimes, ...item }) => ({ ...item, amount: fromCentimes(centimes) }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

/**
 * The management ratios of a compte de résultat (soldes intermédiaires de gestion and the break-even), read from the statement alone:
 * nothing new is stored. `null` is a figure that does not exist yet (no sales: no margin rate, no break-even), never a zero.
 *
 * - chiffre d'affaires: goods sold + production sold;
 * - valeur ajoutée: chiffre d'affaires + the goods made and stored − purchases − the variation of stock − external charges;
 * - EBE (excédent brut d'exploitation): valeur ajoutée + operating subsidies − taxes − wages − social charges;
 * - CAF (capacité d'autofinancement): net result + the charges that are not paid out (the depreciation);
 * - variable charges: what follows the quantity sold (purchases, freight and customs on the goods; see isVariableChargeAccount);
 * - fixed charges: every other operating and financial charge (wages, upkeep, other external charges, interest). The exceptional charges
 *   and the tax on profits are left out, as is the income that is not a sale (the operating subsidies, account 74: `subsidies`; the
 *   financial and other income: `otherNonSalesIncome`);
 * - seuil de rentabilité: the sales at which the result is nil = fixed charges ÷ the rate of margin on variable charges.
 *
 * With the units the building sold in the month (`unitsSold`, read from the supply log, null when not read) the cost of production of a unit:
 * the operating charges (purchases, external charges, wages, taxes...) over the units, against the average price they were sold at. It is where
 * a wage shows in the cost of a unit.
 *
 * @param {ReturnType<typeof incomeStatementOf>} statement
 * @param {{ unitsSold: number | null }} reading
 * The cost of the workforce (the wages and the employer's contributions) and its share of the value added: what the payroll takes of what the building adds.
 * @returns {{ unitsSold: number | null, averagePrice: number | null, costPerUnit: number | null, resultPerUnit: number | null, labourCost: number, labourShare: number | null, turnover: number, valueAdded: number, valueAddedRate: number | null, ebe: number, operatingResult: number, netResult: number,
 *   caf: number, cafRate: number | null, variableCharges: number, fixedCharges: number, subsidies: number, otherNonSalesIncome: number, variableMarginRate: number | null,
 *   breakEven: number | null, safetyMargin: number | null, safetyIndex: number | null }}
 */
export function ratiosOf(statement, { unitsSold }) {
  if (unitsSold === undefined) throw new Error('[finance] the ratios must be told the units sold (a number, or null when they were not read)');
  const line = (id) => statement.sections.flatMap((section) => section.lines).find((candidate) => candidate.id === id);
  const sectionTotal = (id) => toCentimes(statement.sections.find((section) => section.id === id).total);
  const lineCentimes = (id) => toCentimes(line(id).amount);
  const variableChargesCentimes = statement.sections
    .filter((section) => section.id === 'operatingCharges')
    .flatMap((section) => section.lines.flatMap((candidate) => candidate.items))
    .filter((item) => isVariableChargeAccount(item.account))
    .reduce((sum, item) => sum + toCentimes(item.amount), 0);
  const ratio = (part, base) => (base > 0 ? part / base : null);

  const turnover = lineCentimes('goodsSold') + lineCentimes('productionSold');
  // What the stock changed enters the value added: purchases less the stock they leave on the shelf, and the goods made but not yet sold.
  const purchasesAndExternal = lineCentimes('merchandisePurchases') + lineCentimes('materialPurchases') + lineCentimes('stockVariation') + lineCentimes('externalCharges');
  const valueAdded = turnover + lineCentimes('storedProduction') - purchasesAndExternal;
  const labourCost = lineCentimes('wages') + lineCentimes('socialCharges');
  const ebe = valueAdded + lineCentimes('subsidies') - lineCentimes('taxes') - lineCentimes('wages') - lineCentimes('socialCharges');
  const operatingResult = toCentimes(statement.results.operating);
  const netResult = toCentimes(statement.results.net);

  const variableCharges = variableChargesCentimes;
  const fixedCharges = sectionTotal('operatingCharges') + sectionTotal('financialCharges') - variableCharges;
  const nonSalesIncome = lineCentimes('subsidies') + lineCentimes('otherIncome') + sectionTotal('financialIncome');
  const variableMarginRate = ratio(turnover - variableCharges, turnover);
  const breakEven = variableMarginRate !== null && variableMarginRate > 0 ? Math.round(fixedCharges / variableMarginRate) : null;

  const operatingCharges = sectionTotal('operatingCharges');
  const hasUnits = unitsSold !== null && unitsSold > 0;

  return {
    unitsSold: hasUnits ? unitsSold : null,
    averagePrice: hasUnits ? fromCentimes(Math.round(turnover / unitsSold)) : null,
    costPerUnit: hasUnits ? fromCentimes(Math.round(operatingCharges / unitsSold)) : null,
    resultPerUnit: hasUnits ? fromCentimes(Math.round((turnover - operatingCharges) / unitsSold)) : null,
    turnover: fromCentimes(turnover),
    valueAdded: fromCentimes(valueAdded),
    valueAddedRate: ratio(valueAdded, turnover),
    labourCost: fromCentimes(labourCost),
    labourShare: ratio(labourCost, valueAdded),
    ebe: fromCentimes(ebe),
    operatingResult: fromCentimes(operatingResult),
    netResult: fromCentimes(netResult),
    caf: fromCentimes(netResult + lineCentimes('depreciation')),
    cafRate: ratio(netResult + lineCentimes('depreciation'), turnover),
    variableCharges: fromCentimes(variableCharges),
    fixedCharges: fromCentimes(fixedCharges),
    subsidies: fromCentimes(lineCentimes('subsidies')),
    otherNonSalesIncome: fromCentimes(nonSalesIncome - lineCentimes('subsidies')),
    variableMarginRate,
    breakEven: breakEven === null ? null : fromCentimes(breakEven),
    safetyMargin: breakEven === null ? null : fromCentimes(turnover - breakEven),
    safetyIndex: breakEven === null ? null : ratio(turnover - breakEven, turnover),
  };
}

/**
 * @param {Array<{ type: string, amount: number, year: number, month: number, accountBuildingId: string | null, accountKind?: string | null }>} entries the journal lines
 * @param {string} buildingId
 * @param {{ year: number, month?: number, accountKind?: string | null, salesNature?: 'merchandise' | 'production' | 'services' | null, unitsSold?: number | null }} period a month (1 to 12) of a year, or the whole year when month is not given;
 *   accountKind picks a house's account; `salesNature` is required for every account but a house's personal one; `unitsSold` the units the building
 *   sold that month (null when not read: the cost of a unit then shows nothing)
 * @returns {{ statement: ReturnType<typeof incomeStatementOf> | null, wagesReceived: number, publicWageReceived: number, benefitReceived: number, servicesPaid: number, goodsBought: number, incomeTax: number, citizenTax: number, householdResult: number }}
 */
export function buildingFinanceFigures(entries, buildingId, { year, month = null, accountKind = null, salesNature, unitsSold = null }) {
  if (!buildingId) throw new Error('[finance] a building account needs its building');
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const byType = new Map();
  // What a household's two purchase lines are made of, one entry per journal line: the player opens the line that adds them up to see them.
  const details = { services: [], goods: [] };
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey || entry.year !== year) continue;
    if (month !== null && entry.month !== month) continue;
    byType.set(entry.type, (byType.get(entry.type) ?? 0) + toCentimes(entry.amount));
    if (accountKind === 'particulier') {
      const bucket = entry.type === 'service_purchase' ? details.services : entry.type === 'consumer_purchase' ? details.goods : null;
      if (bucket) bucket.push({ id: entry.id, turn: entry.turn, description: entry.description, amount: entry.amount, resource: entry.resource });
    }
  }
  const of = (type) => byType.get(type) ?? 0;

  // The income tax the city gave back at the year's close (an advance that was too high) reaches the household like any receipt.
  const householdIncome = of('household_wage') + of('public_wage') + of('household_benefit') + of('household_participation') + of('household_dividend') + of('income_tax_refund');
  const householdCharges = of('service_purchase') + of('consumer_purchase') + of('rent_paid') + of('income_tax') + of('citizen_tax_paid') + of('employee_contribution');
  const householdResult = householdIncome - householdCharges;

  const statement = accountKind === 'particulier' ? null : incomeStatementOf(entries, buildingId, { year, month, accountKind, salesNature });
  return {
    // A personal account is a household budget, not a compte de résultat.
    statement,
    ratios: statement && ratiosOf(statement, { unitsSold }),
    // What an enterprise did with its result: what its associates were paid after the tax, and what stays in the business. The participation is
    // already a charge of the statement (691). Read from the same lines, nothing is stored. Only an account that shared something has an
    // allocation to show: another company has none.
    allocation: statement && {
      dividends: fromCentimes(of('enterprise_dividend')),
      retained: of('enterprise_dividend') !== 0 || of('enterprise_participation') !== 0
        ? fromCentimes(toCentimes(statement.results.net) - of('enterprise_dividend'))
        : 0,
    },
    wagesReceived: fromCentimes(of('household_wage')),
    publicWageReceived: fromCentimes(of('public_wage')),
    benefitReceived: fromCentimes(of('household_benefit')),
    participationReceived: fromCentimes(of('household_participation')),
    dividendReceived: fromCentimes(of('household_dividend')),
    incomeTaxRefunded: fromCentimes(of('income_tax_refund')),
    servicesPaid: fromCentimes(of('service_purchase')),
    goodsBought: fromCentimes(of('consumer_purchase')),
    rentPaid: fromCentimes(of('rent_paid')),
    incomeTax: fromCentimes(of('income_tax')),
    citizenTax: fromCentimes(of('citizen_tax_paid')),
    employeeContributionPaid: fromCentimes(of('employee_contribution')),
    householdResult: fromCentimes(householdResult),
    details,
  };
}

/**
 * The monthly budget of a house's personal account, read from the month's own lines. A house buys during the month with
 * what it has: its carried savings, the salary of the month before (settled on the first day) and the services of that
 * month (settled the same day), less what it has already bought. Nothing is stored: the carried savings are what the
 * balance was before the month's lines, so the budget is derived from the balance and the lines. `wages` also holds a
 * civil servant's salary and the unemployment benefit (all settled income); `services` also holds the income tax and
 * the citizen tax withheld (settled charges, like a service bill) — the personal account does not separate them further.
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
  // Deposits/withdrawals/their interest move the balance exactly like a purchase/a wage does, but are not
  // themselves "goods bought" or "wages received" (see buildingFinanceInfoView.js's separate épargne-en-banque
  // row) — tracked apart so `carried` still reconstructs the opening balance correctly without mislabelling them.
  let depositedOut = 0;
  let returnedIn = 0;
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey || entry.year !== year || entry.month !== month) continue;
    const amount = toCentimes(entry.amount);
    if (['household_wage', 'public_wage', 'household_benefit', 'household_participation', 'household_dividend', 'income_tax_refund'].includes(entry.type)) wages += amount;
    else if (['service_purchase', 'rent_paid', 'income_tax', 'citizen_tax_paid', 'employee_contribution'].includes(entry.type)) services += amount;
    else if (entry.type === 'consumer_purchase') purchases += amount;
    else if (entry.type === 'deposit') depositedOut += amount;
    else if (entry.type === 'withdrawal' || entry.type === 'household_deposit_interest') returnedIn += amount;
    else throw new Error(`[budget] a personal account holds a "${entry.type}" line, which the household budget does not know`);
  }
  const saved = toCentimes(balance);
  const carried = saved - wages + services + purchases - returnedIn + depositedOut;
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
 * @returns {{ wagesReceived: number, publicWageReceived: number, benefitReceived: number, servicesPaid: number, incomeTax: number, citizenTax: number, goodsBought: number, householdResult: number }}
 */
export function householdLastMonthOf(entries, houseId, { settled, bought }) {
  const settledFigures = buildingFinanceFigures(entries, houseId, { ...settled, accountKind: 'particulier' });
  const boughtFigures = buildingFinanceFigures(entries, houseId, { ...bought, accountKind: 'particulier' });
  return {
    wagesReceived: settledFigures.wagesReceived,
    publicWageReceived: settledFigures.publicWageReceived,
    benefitReceived: settledFigures.benefitReceived,
    participationReceived: settledFigures.participationReceived,
    dividendReceived: settledFigures.dividendReceived,
    incomeTaxRefunded: settledFigures.incomeTaxRefunded,
    servicesPaid: settledFigures.servicesPaid,
    rentPaid: settledFigures.rentPaid,
    incomeTax: settledFigures.incomeTax,
    citizenTax: settledFigures.citizenTax,
    employeeContributionPaid: settledFigures.employeeContributionPaid,
    goodsBought: boughtFigures.goodsBought,
    // The services come from the settlement month, the goods from the month they were bought in, like the two lines they detail.
    details: { services: settledFigures.details.services, goods: boughtFigures.details.goods },
    householdResult: fromCentimes(
      toCentimes(settledFigures.wagesReceived)
        + toCentimes(settledFigures.publicWageReceived)
        + toCentimes(settledFigures.benefitReceived)
        + toCentimes(settledFigures.participationReceived)
        + toCentimes(settledFigures.dividendReceived)
        + toCentimes(settledFigures.incomeTaxRefunded)
        - toCentimes(settledFigures.servicesPaid)
        - toCentimes(settledFigures.rentPaid)
        - toCentimes(settledFigures.incomeTax)
        - toCentimes(settledFigures.citizenTax)
        - toCentimes(settledFigures.employeeContributionPaid)
        - toCentimes(boughtFigures.goodsBought),
    ),
  };
}
