/**
 * The balance sheet of the State (the city), DERIVED from the totals of its account and written nowhere: what it holds (its cash at the central bank, its buildings, its holdings in
 * companies, the loans it granted, what it is owed) against what it owes (its loans, its arrears, the sums it holds for others) and its result. Every écriture of the State balances, so
 * the two sides agree by construction; a gap throws, it is never plugged. Centimes in, euros out.
 * @param {Map<string, { debit: number, credit: number }>} totals the totals of the State's account, every compte
 * @param {(account: string) => string} labelOf the title of an account
 * @returns {{ assets: { lines: Array<{ account: string, label: string, amount: number }>, total: number }, liabilities: { lines: Array<{ account: string, label: string, amount: number }>, total: number }, result: number }}
 *   `result`: the products less the charges (and the years a purge closed): what the State has gained, below nothing for what it has lost
 */
export function stateBalanceSheetOf(totals, labelOf) {
  const assets = [];
  const liabilities = [];
  let result = 0;
  for (const [account, total] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    const net = total.debit - total.credit;
    // The products and the charges are the result; every other account is a line of the balance sheet, on the side its balance falls.
    if (account[0] === '6' || account[0] === '7') result -= net;
    else if (net > 0) assets.push({ account, label: labelOf(account), amount: net });
    else if (net < 0) liabilities.push({ account, label: labelOf(account), amount: -net });
  }
  if (result >= 0) liabilities.push({ account: 'result', label: 'Résultat', amount: result });
  else assets.push({ account: 'result', label: 'Perte', amount: -result });
  const sum = (lines) => lines.reduce((total, line) => total + line.amount, 0);
  if (sum(assets) !== sum(liabilities)) {
    throw new Error(`[state-balance-sheet] the balance sheet of the State does not balance: assets ${sum(assets) / 100}, liabilities ${sum(liabilities) / 100} (an écriture of its account is unbalanced)`);
  }
  const euros = (lines) => lines.map((line) => ({ ...line, amount: line.amount / 100 }));
  return { assets: { lines: euros(assets), total: sum(assets) / 100 }, liabilities: { lines: euros(liabilities), total: sum(liabilities) / 100 }, result: result / 100 };
}
