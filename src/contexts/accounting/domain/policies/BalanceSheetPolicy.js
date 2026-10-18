/**
 * The balance sheet of a company (or of a house's business), DERIVED: read from its own journal lines and from what its stock is worth, and written
 * nowhere. No figure of it is stored.
 *
 * Each line lands on one side through its account (PcgJournalCatalog):
 *   - class 6 and 7 (charges, produits): the result, accumulated since the account opened;
 *   - 101 capital and 164 loans: the liabilities; 213 constructions and 274 loans lent: the fixed assets and financial assets, at cost;
 *   - 457 dividends paid: a distribution that comes off the equity;
 *   - the opérations diverses of the month's closing (they move no money): the variation of stock (37, 35), the depreciation (281), the buildings the
 *     city contributed (213 against the capital 101) and their sortie d'actif when demolished (281 released, the rest a loss in 675); a leg on a charge or
 *     a product joins the result;
 *   - a year closed by a purge (`year_closing`): its net, which joins the accumulated result (its detail is gone).
 * The cash is the treasury's (a second derivation of the same lines) and the stock is valued by the supply. The balance sheet therefore balances only
 * if every line of the journal was placed: a gap between the two sides is an error that names the figure, never a plug.
 *
 * The stock is valued now, at cost. What the closings already posted of it (the variation of stock) is in the result; what the stock changed since the
 * last closing is the variation in progress, which joins the equity so that the two sides agree at any moment. A purge drops the closings it folds: the
 * stock is then carried whole in that variation until the next closing.
 *
 * Not modelled yet, because the game does not make them happen: receivables and payables (everything is paid at once).
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { moneyDirectionOf } from './TreasuryFromJournalPolicy.js';
import { postingsOf } from './AccountLedgerPolicy.js';
import { isOperationDiverse, pcgOfJournalType } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

/** The debt accounts of PayableCatalog: wages (421), social contributions (431), tax (444), rent of the premises (401). */
const PAYABLE_ACCOUNTS = new Set(['421', '431', '444', '401']);

const toCentimes = (amount) => Math.round(amount * 100);
const fromCentimes = (centimes) => centimes / 100;

/**
 * @param {Array<{ type: string, amount: number, turn?: number, accountBuildingId: string | null, accountKind?: string | null, closing?: { net: number } }>} entries the journal lines
 * @param {string} buildingId
 * @param {{ accountKind?: string | null, cash: number, stock: ReadonlyArray<{ category: string, amount: number, unitCost: number, value: number }>, currentYear: number }} reading
 *   `cash`: the account's treasury; `stock`: what the supply says the building holds, valued at cost; `currentYear`: tells the result of the year from the carried one
 * @returns {{
 *   assets: { fixedAssets: number, accumulatedDepreciation: number, loansLent: number, stock: { items: ReadonlyArray<object>, total: number }, cash: number, total: number },
 *   liabilities: { capital: number, accumulatedResult: number, carriedResult: number, yearResult: number, stockVariation: number, distributions: number, equity: number, loans: number, total: number },
 * }}
 */
export function balanceSheetOf(entries, buildingId, { accountKind = null, cash, stock, currentYear }) {
  if (!buildingId) throw new Error('[balance-sheet] a balance sheet needs its building');
  if (!Number.isInteger(currentYear)) throw new Error('[balance-sheet] a balance sheet needs the current year, to tell the result of the year from the carried one');
  if (accountKind === 'particulier') throw new Error('[balance-sheet] a household is not an entity of the plan comptable: it has no balance sheet');
  if (!Number.isFinite(cash)) throw new Error(`[balance-sheet] the cash of ${buildingId} was not read`);
  if (!Array.isArray(stock)) throw new Error(`[balance-sheet] the stock of ${buildingId} was not read`);
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });

  // The result is split by year at display time: what the years before this one made is the carried result (the report à nouveau), this year's is the
  // result of the year. No line is written for the split: it is the same lines read by their year.
  let result = 0;
  let previousResult = 0;
  const addResult = (centimes, year) => {
    if (!Number.isInteger(year)) throw new Error(`[balance-sheet] a line of ${buildingId} has no year: its result cannot be placed`);
    result += centimes;
    if (year < currentYear) previousResult += centimes;
  };
  let capital = 0;
  let loans = 0;
  let fixedAssets = 0;
  let accumulatedDepreciation = 0;
  let postedStock = 0;
  let loansLent = 0;
  let distributions = 0;
  // What the company owes (wages, contributions, tax, rent: credit balances of the accounts of PayableCatalog) and what it is owed (the owner's rents, 411).
  const payables = new Map();
  const addPayable = (account, centimes) => payables.set(account, (payables.get(account) ?? 0) + centimes);
  let receivables = 0;
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey) continue;
    if (isOperationDiverse(entry.type)) {
      for (const leg of postingsOf(entry)) {
        const net = leg.debit - leg.credit;
        if (leg.account[0] === '6' || leg.account[0] === '7') addResult(-net, entry.year);
        else if (leg.account === '281') accumulatedDepreciation -= net;
        else if (leg.account === '213') fixedAssets += net;
        else if (leg.account === '101') capital -= net;
        else if (PAYABLE_ACCOUNTS.has(leg.account)) addPayable(leg.account, -net);
        else if (leg.account === '411') receivables += net;
        else if (leg.account === '37' || leg.account === '35') postedStock += net;
        else throw new Error(`[balance-sheet] the closing line "${entry.type}" (account ${leg.account}) of ${buildingId} has no place in the balance sheet`);
      }
      continue;
    }
    const direction = moneyDirectionOf(entry);
    if (!direction) continue;
    if (direction === 'closing') {
      // A purged year: its result, and the balances it carried (the accounts' nets, debit minus credit) put back where the lines would have put them.
      if (!entry.closing.balances) throw new Error(`[balance-sheet] the closing of year ${entry.closing.year} of ${buildingId} carries no balances: it was written by an older purge`);
      const carried = toCentimes(entry.closing.result);
      result += carried;
      previousResult += carried;
      for (const [account, amount] of Object.entries(entry.closing.balances)) {
        const net = toCentimes(amount);
        if (account === '512') continue;
        if (account === '101') capital -= net;
        else if (account === '164') loans -= net;
        else if (account === '213') fixedAssets += net;
        else if (account === '274') loansLent += net;
        else if (account === '457') distributions -= net;
        else if (account === '281') accumulatedDepreciation -= net;
        else if (account === '37' || account === '35') postedStock += net;
        else if (PAYABLE_ACCOUNTS.has(account)) addPayable(account, -net);
        else if (account === '411') receivables += net;
        else throw new Error(`[balance-sheet] the closing of year ${entry.closing.year} of ${buildingId} carries the account ${account}, which has no place in the balance sheet`);
      }
      continue;
    }
    const pcg = pcgOfJournalType(entry.type);
    if (!pcg) throw new Error(`[balance-sheet] the money line "${entry.type}" has no account in the chart of accounts`);
    const signed = direction === 'credit' ? toCentimes(entry.amount) : -toCentimes(entry.amount);
    const { account } = pcg;
    if (account[0] === '6' || account[0] === '7') addResult(signed, entry.year);
    else if (account === '101') capital += signed;
    else if (account === '164') loans += signed;
    else if (account === '213') fixedAssets -= signed;
    else if (account === '274') loansLent -= signed;
    else if (account === '457') distributions += signed;
    else if (PAYABLE_ACCOUNTS.has(account)) addPayable(account, signed);
    else if (account === '411') receivables -= signed;
    else throw new Error(`[balance-sheet] the line "${entry.type}" (account ${account}) of ${buildingId} has no place in the balance sheet`);
  }

  const stockTotal = stock.reduce((sum, item) => sum + toCentimes(item.value), 0);
  const cashCentimes = toCentimes(cash);
  const stockInProgress = stockTotal - postedStock;
  const payablesTotal = [...payables.values()].reduce((sum, centimes) => sum + centimes, 0);
  // An account below nothing is an overdraft (the bank's concours courants, 519), a debt of the company; only money held is an asset.
  const cashHeld = Math.max(0, cashCentimes);
  const overdraft = Math.max(0, -cashCentimes);
  const assetsTotal = fixedAssets - accumulatedDepreciation + loansLent + receivables + stockTotal + cashHeld;
  const equity = capital + result + stockInProgress + distributions;
  const liabilitiesTotal = equity + loans + payablesTotal + overdraft;
  if (assetsTotal !== liabilitiesTotal) {
    throw new Error(`[balance-sheet] the balance sheet of ${buildingId} does not balance: assets ${fromCentimes(assetsTotal)}, liabilities ${fromCentimes(liabilitiesTotal)} (a line of its journal was not placed, or its cash is not the sum of its lines)`);
  }

  return {
    assets: {
      fixedAssets: fromCentimes(fixedAssets),
      accumulatedDepreciation: fromCentimes(accumulatedDepreciation),
      loansLent: fromCentimes(loansLent),
      receivables: fromCentimes(receivables),
      stock: { items: stock, total: fromCentimes(stockTotal) },
      cash: fromCentimes(cashHeld),
      total: fromCentimes(assetsTotal),
    },
    liabilities: {
      capital: fromCentimes(capital),
      accumulatedResult: fromCentimes(result),
      carriedResult: fromCentimes(previousResult),
      yearResult: fromCentimes(result - previousResult),
      stockVariation: fromCentimes(stockInProgress),
      distributions: fromCentimes(distributions),
      equity: fromCentimes(equity),
      loans: fromCentimes(loans),
      overdraft: fromCentimes(overdraft),
      payables: Object.fromEntries([...payables].filter(([, centimes]) => centimes !== 0).map(([account, centimes]) => [account, fromCentimes(centimes)])),
      total: fromCentimes(liabilitiesTotal),
    },
  };
}
