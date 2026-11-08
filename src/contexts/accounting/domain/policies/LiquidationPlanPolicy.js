import { payByRank, planCompanyPayments } from './DebtPolicy.js';

/**
 * What the liquidation of one account does, worked out from what the account holds (see LiquidateDemolishedBuilding.js). Pure: the preview the player reads before a
 * demolition and the lines the demolition writes are both this plan, so they cannot differ.
 *
 *   1. the stock is written off the books and sold at the liquidation rate (`recoveryRate` of its value at cost): the proceeds join the cash, and so does what a bank
 *      collects back before it closes (`collected`: the city repays its loans, the companies their credit as far as their cash goes);
 *   2. the creditors are paid by rank (the wages first, then the city, then the owner) as far as the cash goes, the creditors of one rank sharing in proportion;
 *   3. what is left of a debt is abandoned: the debtor is released, and the creditor bears the loss (the city advances the wages, so the workers are made whole);
 *   4. what the company owes the bank of its credit is paid back as far as the cash left goes; the rest is abandoned (and lost by the bank);
 *   5. a bank gives its depositors their savings back as far as the cash left goes, all of them in proportion; what it cannot give, the city guarantees;
 *   6. a bank repays the central bank its refinancing as far as the cash left goes; the rest is abandoned (and lost by the central bank);
 *   7. what the company still owes the city of a loan of working capital is paid back as far as the cash left goes; the rest of that loan is abandoned (and lost by the city);
 *   8. what is left of the cash goes back to the city, up to the capital it put in (its holding in the company); the rest of the holding is lost.
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
 * @param {number} account.bankCredit what the company owes the bank of its credit, in centimes
 * @param {number} account.collected what a bank collects back before it closes, in centimes (0 for any other company)
 * @param {ReadonlyArray<{ id: string, amount: number }>} account.deposits what a bank owes each depositor (by house), in centimes (none for any other company)
 * @param {number} account.refinancing what a bank owes the central bank, in centimes
 * @param {number} account.depositGuaranteeCap what the city guarantees each saver of a bank at most, in centimes
 * @returns {{
 *   stockOut: Array<{ nature: 'merchandise' | 'production', posted: number }>,
 *   stockProceeds: number,
 *   paid: Map<string, number>,
 *   unpaid: Map<string, number>,
 *   bankCreditRepaid: number,
 *   bankCreditLost: number,
 *   depositsPaid: Map<string, number>,
 *   depositsGuaranteed: Map<string, number>,
 *   depositsLost: Map<string, number>,
 *   refinancingRepaid: number,
 *   refinancingLost: number,
 *   loanRepaid: number,
 *   loanLost: number,
 *   surplusToCity: number,
 *   holdingLoss: number,
 * }} the stocks to write off the books, the proceeds of their sale, what each debt receives and what remains of it, what is paid back of the bank's credit and what is
 *   lost of it, what each depositor gets back and what the city guarantees, what is paid back of the refinancing and what is lost of it, what is paid back of the loan and
 *   what is lost of it, the cash that goes back to the city, the capital that is lost
 */
export function planLiquidation({ cash, stocks, debts, holding, loan, recoveryRate, bankCredit, collected, deposits, refinancing, depositGuaranteeCap }) {
  if (!(depositGuaranteeCap >= 0)) throw new Error(`[liquidation] the deposit guarantee cap is an amount of at least 0 centimes, got ${depositGuaranteeCap}`);
  for (const [name, value] of Object.entries({ loan, bankCredit, collected, refinancing })) {
    if (!(value >= 0)) throw new Error(`[liquidation] ${name} is an amount of at least 0, got ${value}`);
  }
  if (!(recoveryRate >= 0 && recoveryRate <= 1)) throw new Error(`[liquidation] the recovery rate is a share between 0 and 1, got ${recoveryRate}`);
  const stockOut = stocks.filter((stock) => stock.posted !== 0).map(({ nature, posted }) => ({ nature, posted }));
  const stockProceeds = stocks.reduce((sum, stock) => sum + Math.round(Math.max(0, stock.live) * recoveryRate), 0);

  const { debtPaid, left: afterDebts } = planCompanyPayments({ cash: cash + stockProceeds + collected, debts, charges: [] });
  const paid = new Map(debts.map((debt) => [debt.id, debtPaid.get(debt.id) ?? 0]));
  const unpaid = new Map(debts.map((debt) => [debt.id, debt.amount - (debtPaid.get(debt.id) ?? 0)]));
  let left = afterDebts;
  const take = (owed) => {
    const repaid = Math.max(0, Math.min(left, owed));
    left -= repaid;
    return repaid;
  };

  const bankCreditRepaid = take(bankCredit);
  // The depositors share what is left in proportion to their savings, all of one rank.
  const depositsSettled = payByRank(left, deposits.map((deposit) => ({ ...deposit, rank: 0 })));
  // An account below nothing pays nobody and stays below nothing.
  if (left > 0) left = depositsSettled.left;
  const depositsPaid = new Map(deposits.map((deposit) => [deposit.id, depositsSettled.paid.get(deposit.id) ?? 0]));
  // The city makes each saver whole only up to the cap (what the bank paid counts towards it); what is owed beyond is the saver's loss.
  const depositsGuaranteed = new Map(deposits.map((deposit) => [deposit.id, Math.max(0, Math.min(deposit.amount, depositGuaranteeCap) - depositsPaid.get(deposit.id))]));
  const depositsLost = new Map(deposits.map((deposit) => [deposit.id, deposit.amount - depositsPaid.get(deposit.id) - depositsGuaranteed.get(deposit.id)]));
  const refinancingRepaid = take(refinancing);
  const loanRepaid = take(loan);
  const surplusToCity = Math.max(0, Math.min(left, Math.max(0, holding)));
  return {
    stockOut, stockProceeds, paid, unpaid,
    bankCreditRepaid, bankCreditLost: bankCredit - bankCreditRepaid,
    depositsPaid, depositsGuaranteed, depositsLost,
    refinancingRepaid, refinancingLost: refinancing - refinancingRepaid,
    loanRepaid, loanLost: loan - loanRepaid,
    surplusToCity, holdingLoss: Math.max(0, holding) - surplusToCity,
  };
}
