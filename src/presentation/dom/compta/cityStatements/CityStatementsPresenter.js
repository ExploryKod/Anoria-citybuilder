/**
 * CityStatementsPresenter — the compte de résultat, the balance sheet and the balance of the city, in the M57 model (see GetCityStatements): what the journal says,
 * by account. They read like a company's balance sheet (the Finances tab of a building): two tables side by side in the model (charges and products, assets and
 * liabilities), each with its total, the accounts lighter under their family, nothing more than the figures. The words of the accounts come from the catalog;
 * nothing is computed here.
 */

import { sideTable } from '../../info/views/balanceSheetView.js';
import { trialBalanceView } from '../../info/views/accountLedgerView.js';

/** @param {string} tag @param {string | null} [className] @param {string} [text] @returns {HTMLElement} */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The compte de résultat of the year, laid out like the balance sheet: the charges on one table, the products on the next, each with its total. A section is
 * a row that carries its total, its families of accounts under it, and under each the accounts that feed it, lighter. The result is the row that makes the two
 * sides equal: an excess on the charges side, a deficit on the products side.
 * @param {{ incomeStatement: object }} statements the answer of GetCityStatements
 * @returns {HTMLElement[]}
 */
export function renderIncomeStatement({ incomeStatement }) {
  const rowsBySide = { product: [], charge: [] };
  const totalBySide = { product: 0, charge: 0 };
  for (const section of incomeStatement.sections) {
    const shown = section.lines.filter((line) => line.amount !== 0);
    if (shown.length === 0) continue;
    const rows = rowsBySide[section.side];
    rows.push({ label: section.label, amount: section.total, kind: 'section' });
    for (const line of shown) {
      rows.push({ label: line.label, amount: line.amount, tone: line.tone, pill: line.prefixes.join(', ') });
      for (const item of line.accounts) rows.push({ label: item.label, amount: item.amount, kind: 'detail', tone: line.tone, pill: item.account });
    }
    totalBySide[section.side] += Math.round(section.total * 100);
  }
  const net = incomeStatement.results.net;
  if (net >= 0) rowsBySide.charge.push({ label: 'Résultat de l’exercice (excédent)', amount: net, kind: 'subtotal' });
  else rowsBySide.product.push({ label: 'Résultat de l’exercice (déficit)', amount: -net, kind: 'subtotal' });
  const wrapper = el('div', 'building-finance-statement balance-sheet');
  wrapper.append(
    sideTable('Charges', rowsBySide.charge, (totalBySide.charge + (net >= 0 ? Math.round(net * 100) : 0)) / 100),
    sideTable('Produits', rowsBySide.product, (totalBySide.product + (net < 0 ? Math.round(-net * 100) : 0)) / 100),
  );
  return [wrapper];
}

/**
 * The balance sheet: the assets on one table, the liabilities on the next, each with its total — the tables of a company's balance sheet.
 * @param {{ balanceSheet: object }} statements
 * @returns {HTMLElement[]}
 */
export function renderBalanceSheet({ balanceSheet }) {
  const rowsOf = (groups) =>
    groups.flatMap((group) =>
      group.accounts.length === 0
        ? []
        : [
            { label: group.label, amount: group.total, kind: 'section' },
            ...group.accounts.map((item) => ({ label: item.label, amount: item.amount, kind: 'detail', tone: group.tone, pill: item.account })),
          ],
    );
  const { assets, liabilities } = balanceSheet;
  const liabilityRows = [
    ...rowsOf(liabilities.groups),
    { label: 'Résultats des exercices précédents', amount: liabilities.previousResults, note: 'Les résultats des années non encore reportées par une clôture' },
    { label: 'Résultat de l’exercice', amount: liabilities.yearResult, note: 'Le résultat de l’année : celui du compte de résultat' },
  ];
  const wrapper = el('div', 'building-finance-statement balance-sheet');
  wrapper.append(sideTable('Actif', rowsOf(assets.groups), assets.total), sideTable('Passif', liabilityRows, liabilities.total));
  return [wrapper];
}

/**
 * The balance: each account with its debits, its credits and its balances, and the totals of the two columns — the table of a company's balance.
 * @param {{ trialBalance: object }} statements
 * @returns {HTMLElement[]}
 */
export function renderTrialBalance({ trialBalance }) {
  return [trialBalanceView(trialBalance)];
}
