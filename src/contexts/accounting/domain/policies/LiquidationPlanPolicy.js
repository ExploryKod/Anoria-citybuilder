import { planCompanyPayments } from './DebtPolicy.js';

/**
 * What the liquidation of one account does, worked out from what the account holds (see LiquidateDemolishedBuilding.js). Pure: the preview the player reads before a
 * demolition and the lines the demolition writes are both this plan, so they cannot differ.
 *
 *   1. the stock is written off the books and sold at the liquidation rate (`recoveryRate` of its value at cost): the proceeds join the cash;
 *   2. the creditors are paid by rank (the wages first, then the city, then the owner) as far as the cash goes, the creditors of one rank sharing in proportion;
 *   3. what is left of a debt is abandoned: the debtor is released, and the creditor bears the loss (the city advances the wages, so the workers are made whole);
 *   4. what the company still owes the city of a loan of working capital is paid back as far as the cash left goes; the rest of that loan is abandoned (and lost by the city);
 *   5. what is left of the cash goes back to the city, up to the capital it put in (its holding in the company); the rest of the holding is lost.
 *
 * Sums are in centimes, so the figures are exact.
 */

/**
 * @param {object} account
 * @param {number} account.cash what the account holds, in centimes (it may be below nothing: an overdraft)
 * @param {Array<{ nature: 'merchandise' | 'production', posted: number, live: number }>} account.stocks each stock the books carry (`posted`) and what it is worth at cost now (`live`)
 * @param {ReadonlyArray<{ id: string, rank: number, amount: number }>} account.debts what the account owes, by creditor and kind
 * @param {number} account.holding what the city put into the company and did not take back, in centimes
 * @param {number} account.loan what the company still owes the city of its working-capital loans, in centimes
 * @param {number} account.recoveryRate the share of the stock's value the sale fetches (0 to 1)
 * @returns {{
 *   stockOut: Array<{ nature: 'merchandise' | 'production', posted: number }>,
 *   stockProceeds: number,
 *   paid: Map<string, number>,
 *   unpaid: Map<string, number>,
 *   loanRepaid: number,
 *   loanLost: number,
 *   surplusToCity: number,
 *   holdingLoss: number,
 * }} the stocks to write off the books, the proceeds of their sale, what each debt receives and what remains of it, what is paid back of the loan and what is lost of it, the cash that goes back to the city, the capital that is lost
 */
export function planLiquidation({ cash, stocks, debts, holding, loan, recoveryRate }) {
  if (!(loan >= 0)) throw new Error(`[liquidation] the loan a company still owes the city is an amount of at least 0, got ${loan}`);
  if (!(recoveryRate >= 0 && recoveryRate <= 1)) throw new Error(`[liquidation] the recovery rate is a share between 0 and 1, got ${recoveryRate}`);
  const stockOut = stocks.filter((stock) => stock.posted !== 0).map(({ nature, posted }) => ({ nature, posted }));
  const stockProceeds = stocks.reduce((sum, stock) => sum + Math.round(Math.max(0, stock.live) * recoveryRate), 0);

  const { debtPaid, left } = planCompanyPayments({ cash: cash + stockProceeds, debts, charges: [] });
  const paid = new Map(debts.map((debt) => [debt.id, debtPaid.get(debt.id) ?? 0]));
  const unpaid = new Map(debts.map((debt) => [debt.id, debt.amount - (debtPaid.get(debt.id) ?? 0)]));

  const loanRepaid = Math.max(0, Math.min(left, loan));
  const surplusToCity = Math.max(0, Math.min(left - loanRepaid, Math.max(0, holding)));
  return { stockOut, stockProceeds, paid, unpaid, loanRepaid, loanLost: loan - loanRepaid, surplusToCity, holdingLoss: Math.max(0, holding) - surplusToCity };
}
