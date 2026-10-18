import { withholdIncomeTax } from './ProducerChargePolicy.js';

/**
 * The withholding at source of one month: what the payer of each pay (an employer for a wage, the city for its own benefit and stipend) keeps back before it
 * pays the household, and hands to the city. A household's pay is one payslip per payer: the gross, what is withheld (its social contribution and its income
 * tax) and what reaches its account.
 *
 * The income tax is the household's (foyer): progressive over everything it receives in the month, from every workplace and from the city, after the
 * employee's contribution. Each payer withholds its share of it, so the household pays in total what the same bands give on its whole income, to the centime.
 * The year's regularisation (SettleProducerCharges) settles what the months did not, dividends and participation included.
 *
 * Sums are in centimes, so the figures are exact.
 */

/** @typedef {{ key: string, houseId: string, kind: 'wage' | 'public', gross: number }} PaySlot one pay a household receives in the month: its gross, in centimes (`wage` carries the employee's contribution, `public` does not) */

/**
 * Splits a total over some shares in proportion to their weights, to the centime: each share is rounded and the last one takes what the rounding left.
 * @param {number} total centimes
 * @param {number[]} weights
 * @returns {number[]}
 */
function allocate(total, weights) {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const last = weights.map((weight) => weight > 0).lastIndexOf(true);
  let given = 0;
  return weights.map((weight, index) => {
    if (index === last) return total - given;
    const share = Math.round((total * weight) / sum);
    given += share;
    return share;
  });
}

/**
 * @param {{ slots: PaySlot[], employeeRate: number, taxRate: { threshold1: number, rate1: number, threshold2: number, rate2: number } }} month
 *   `employeeRate`: the employee's social contribution, a fraction of the gross wage; `taxRate`: the bands (euros a month, see withholdIncomeTax)
 * @returns {Map<string, { contribution: number, tax: number }>} what each pay withholds, by slot key, in centimes
 */
export function planWithholding({ slots, employeeRate, taxRate }) {
  if (!Number.isFinite(employeeRate) || employeeRate < 0 || employeeRate > 1) throw new Error(`[withholding] the employee's contribution rate must be a fraction, got ${employeeRate}`);
  const byHouse = new Map();
  for (const slot of slots) {
    if (!Number.isInteger(slot.gross) || slot.gross < 0) throw new Error(`[withholding] the pay ${slot.key} must be a whole number of centimes, got ${slot.gross}`);
    byHouse.set(slot.houseId, [...(byHouse.get(slot.houseId) ?? []), slot]);
  }
  const plan = new Map();
  for (const houseSlots of byHouse.values()) {
    const wages = houseSlots.filter((slot) => slot.kind === 'wage');
    const contributionTotal = Math.round(wages.reduce((sum, slot) => sum + slot.gross, 0) * employeeRate);
    const contributionShares = allocate(contributionTotal, wages.map((slot) => slot.gross));
    const contributions = new Map(wages.map((slot, index) => [slot.key, contributionShares[index]]));
    // The tax is on what the household receives after the contribution; each pay carries its share of it.
    const bases = houseSlots.map((slot) => slot.gross - (contributions.get(slot.key) ?? 0));
    const taxTotal = Math.round(withholdIncomeTax({ gross: bases.reduce((sum, base) => sum + base, 0) / 100, ...taxRate }).incomeTax * 100);
    const taxes = allocate(taxTotal, bases);
    houseSlots.forEach((slot, index) => plan.set(slot.key, { contribution: contributions.get(slot.key) ?? 0, tax: taxes[index] }));
  }
  return plan;
}

/**
 * The legs of a household's payslip: the gross credited to what the payer owes it (421 wages, 437 benefit), debited by what is withheld (431 contribution,
 * 4421 income tax) and by what reaches its account (512). Null when nothing is withheld: the pay is then an écriture of two legs like any other.
 * @param {{ creditAccount: string, gross: number, contribution: number, tax: number }} payslip centimes
 * @returns {Array<{ account: string, debit: number, credit: number }> | null}
 */
export function payslipLegs({ creditAccount, gross, contribution, tax }) {
  if (contribution === 0 && tax === 0) return null;
  const net = gross - contribution - tax;
  if (net < 0) throw new Error(`[withholding] a pay of ${gross / 100} cannot withhold ${(contribution + tax) / 100}: more than it pays`);
  return [
    ...(net > 0 ? [{ account: '512', debit: net, credit: 0 }] : []),
    ...(contribution > 0 ? [{ account: '431', debit: contribution, credit: 0 }] : []),
    ...(tax > 0 ? [{ account: '4421', debit: tax, credit: 0 }] : []),
    { account: creditAccount, debit: 0, credit: gross },
  ];
}
