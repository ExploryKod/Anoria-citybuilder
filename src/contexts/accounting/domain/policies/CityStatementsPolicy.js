/**
 * The compte de résultat and the balance sheet of the city (or of a hamlet), in the M57 model (see M57StatementCatalog), DERIVED from the totals of its comptes in
 * the fold of the journal's legs (LegsFold): nothing is stored, no écriture is added for a result or a total. The two sides of the balance sheet must balance, which
 * they do because every écriture does; a gap throws, it is never plugged.
 *
 * Sums are in centimes in the totals read, and in euros in what is returned.
 */

import { M57_BALANCE_GROUPS, M57_INCOME_STATEMENT, m57LineOfAccount } from '../../../../shared/accounting-catalog/M57StatementCatalog.js';
import { accountLabelOf } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

const fromCentimes = (centimes) => centimes / 100;

/** @typedef {Map<string, { debit: number, credit: number }>} AccountTotals the totals of each compte, in centimes (LegsFold.totalsOf) */

/**
 * The compte de résultat of a year: each line is the products (credit less debit) or the charges (debit less credit) of its accounts.
 * @param {AccountTotals} totals the totals of the year's own écritures
 * @returns {{ sections: Array<{ id: string, label: string, side: string, total: number, lines: Array<{ id: string, label: string, amount: number, accounts: Array<{ account: string, label: string, amount: number }> }> }>,
 *   results: { operating: number, financial: number, specific: number, net: number } }}
 */
export function cityIncomeStatementOf(totals) {
  const byLine = new Map();
  for (const [account, total] of totals) {
    if (account[0] !== '6' && account[0] !== '7') continue;
    const placed = m57LineOfAccount(account);
    if (!placed) throw new Error(`[city-statements] the account ${account} has no line in the compte de résultat of the city`);
    // A product counts what is credited less what is debited, a charge the other way round.
    const amount = account[0] === '7' ? total.credit - total.debit : total.debit - total.credit;
    if (amount === 0) continue;
    const accounts = byLine.get(placed.line.id) ?? [];
    accounts.push({ account, label: accountLabelOf(account), amount });
    byLine.set(placed.line.id, accounts);
  }
  const sections = M57_INCOME_STATEMENT.map((section) => {
    const lines = section.lines.map((line) => {
      // In the order of the chart: an account stands before its sub-accounts' neighbours (73111 before 735).
      const accounts = (byLine.get(line.id) ?? []).sort((a, b) => a.account.localeCompare(b.account, 'en'));
      return {
        id: line.id,
        label: line.label,
        tone: line.tone,
        prefixes: line.accounts,
        amount: fromCentimes(accounts.reduce((sum, item) => sum + item.amount, 0)),
        accounts: accounts.map((item) => ({ ...item, amount: fromCentimes(item.amount) })),
      };
    });
    return { id: section.id, label: section.label, side: section.side, total: fromCentimes(lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0)), lines };
  });
  const total = (id) => Math.round(sections.find((section) => section.id === id).total * 100);
  const operating = total('operatingProducts') - total('operatingCharges');
  const financial = total('financialProducts') - total('financialCharges');
  const specific = total('specificProducts') - total('specificCharges');
  return { sections, results: { operating: fromCentimes(operating), financial: fromCentimes(financial), specific: fromCentimes(specific), net: fromCentimes(operating + financial + specific) } };
}

/**
 * The balance (balance générale) of the city: each compte its debits and credits have been posted to, with its balance, and the totals of the two columns, which
 * are equal because every écriture balances (a gap throws).
 * @param {AccountTotals} totals the totals of every écriture up to a point in time
 * @returns {{ accounts: Array<{ account: string, label: string, debit: number, credit: number, debitBalance: number, creditBalance: number }>, totals: { debit: number, credit: number, debitBalance: number, creditBalance: number } }}
 */
export function cityTrialBalanceOf(totals) {
  const accounts = [...totals]
    .filter(([, total]) => total.debit !== 0 || total.credit !== 0)
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([account, total]) => {
      const net = total.debit - total.credit;
      return {
        account,
        label: accountLabelOf(account),
        debit: fromCentimes(total.debit),
        credit: fromCentimes(total.credit),
        debitBalance: fromCentimes(net > 0 ? net : 0),
        creditBalance: fromCentimes(net < 0 ? -net : 0),
      };
    });
  const debit = [...totals.values()].reduce((sum, total) => sum + total.debit, 0);
  const credit = [...totals.values()].reduce((sum, total) => sum + total.credit, 0);
  if (debit !== credit) throw new Error(`[city-statements] the balance of the city does not balance: debits ${fromCentimes(debit)}, credits ${fromCentimes(credit)}`);
  const balance = (side) => fromCentimes(accounts.reduce((sum, item) => sum + Math.round(item[side] * 100), 0));
  return { accounts, totals: { debit: fromCentimes(debit), credit: fromCentimes(credit), debitBalance: balance('debitBalance'), creditBalance: balance('creditBalance') } };
}

/**
 * The balance sheet at a point in time: each balance-sheet account on the side its balance puts it, grouped by nature, and the result beside the equity.
 * @param {AccountTotals} totals the totals of every écriture up to that point
 * @param {{ yearTotals: AccountTotals }} reading the totals of the current year alone, which tell the result of the year from the results of the years before it
 * @returns {{ assets: { groups: Array<{ id: string, label: string, total: number, accounts: Array<{ account: string, label: string, amount: number }> }>, total: number },
 *   liabilities: { groups: Array<{ id: string, label: string, total: number, accounts: Array<{ account: string, label: string, amount: number }> }>, yearResult: number, previousResults: number, total: number } }}
 */
export function cityBalanceSheetOf(totals, { yearTotals }) {
  const placed = { assets: new Map(), liabilities: new Map() };
  const sideOf = (account, net) => {
    const cls = account[0];
    if (cls === '2' || cls === '3') return 'assets';
    if (cls === '1') return 'liabilities';
    if (cls === '4' || cls === '5') return net >= 0 ? 'assets' : 'liabilities';
    return null;
  };
  let resultCentimes = 0;
  let yearResultCentimes = 0;
  for (const [account, total] of totals) {
    const net = total.debit - total.credit;
    if (account[0] === '6' || account[0] === '7') {
      resultCentimes -= net;
      continue;
    }
    const side = sideOf(account, net);
    if (side === null) throw new Error(`[city-statements] the account ${account} is neither a balance-sheet account nor a charge or a product`);
    if (net === 0) continue;
    const group = M57_BALANCE_GROUPS[side].find((candidate) => candidate.accounts.some((prefix) => account.startsWith(prefix)));
    if (!group) throw new Error(`[city-statements] the account ${account} has no place in the balance sheet of the city`);
    const items = placed[side].get(group.id) ?? [];
    // On the asset side the balance is the amount (a depreciation, a credit balance, takes off); on the liability side it is the other way round.
    items.push({ account, label: accountLabelOf(account), amount: side === 'assets' ? net : -net });
    placed[side].set(group.id, items);
  }
  for (const [account, total] of yearTotals) {
    if (account[0] === '6' || account[0] === '7') yearResultCentimes -= total.debit - total.credit;
  }
  const groupsOf = (side) =>
    M57_BALANCE_GROUPS[side].map((group) => {
      const accounts = (placed[side].get(group.id) ?? []).sort((a, b) => a.account.localeCompare(b.account, 'en'));
      return { id: group.id, label: group.label, tone: group.tone, centimes: accounts.reduce((sum, item) => sum + item.amount, 0), accounts: accounts.map((item) => ({ ...item, amount: fromCentimes(item.amount) })) };
    });
  const assets = groupsOf('assets');
  const liabilities = groupsOf('liabilities');
  const assetsTotal = assets.reduce((sum, group) => sum + group.centimes, 0);
  const liabilitiesTotal = liabilities.reduce((sum, group) => sum + group.centimes, 0) + resultCentimes;
  if (assetsTotal !== liabilitiesTotal) {
    throw new Error(`[city-statements] the balance sheet of the city does not balance: assets ${fromCentimes(assetsTotal)}, liabilities ${fromCentimes(liabilitiesTotal)} (an account of its journal was not placed)`);
  }
  const strip = ({ centimes, ...group }) => ({ ...group, total: fromCentimes(centimes) });
  return {
    assets: { groups: assets.map(strip), total: fromCentimes(assetsTotal) },
    liabilities: { groups: liabilities.map(strip), yearResult: fromCentimes(yearResultCentimes), previousResults: fromCentimes(resultCentimes - yearResultCentimes), total: fromCentimes(liabilitiesTotal) },
  };
}
