import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { goodLabel } from '../../shell/CatalogVocabulary.js';
import { accountLabelOf } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

/**
 * The balance sheet of a company, as it stands now (the accounting context derives it from the journal, the cash and the stock at cost): the assets
 * on one table, the liabilities on the next, each with its total. The accounting words are written here on purpose, like the statement's.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** One table: a title, its rows (`{ label, amount, kind?, note? }`), and its total. */
function sideTable(title, rows, total) {
  const table = el('table', 'building-finance-table balance-sheet-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const th = el('th', null, title);
  th.scope = 'col';
  th.colSpan = 2;
  headRow.append(th);
  head.append(headRow);

  const body = document.createElement('tbody');
  for (const row of [...rows, { label: `Total ${title.toLowerCase()}`, amount: total, kind: 'total' }]) {
    const tr = el('tr', `balance-sheet-row${row.kind ? ` balance-sheet-row--${row.kind}` : ''}`);
    const label = el('th', null, row.label);
    label.scope = 'row';
    if (row.note) label.title = row.note;
    tr.append(label, el('td', 'balance-sheet-amount', row.amount === null ? '' : formatEuro(row.amount)));
    body.append(tr);
  }
  table.append(head, body);
  return table;
}

/**
 * @param {ReturnType<import('../../../../contexts/accounting/domain/policies/BalanceSheetPolicy.js').balanceSheetOf>} sheet
 * @returns {HTMLElement}
 */
export function balanceSheetView(sheet) {
  const { assets, liabilities } = sheet;
  const assetRows = [
    { label: 'Immobilisations (213)', amount: assets.fixedAssets, note: 'Constructions, au coût' },
    { label: 'Amortissements (281)', amount: -assets.accumulatedDepreciation, note: 'Ce que les constructions ont perdu de leur valeur depuis leur construction' },
    { label: 'Prêts (274)', amount: assets.loansLent },
    { label: 'Stocks', amount: assets.stock.total, note: 'Valorisés au coût : coût de production pour ce que le bâtiment fabrique, coût moyen des livraisons pour ce qu’il revend' },
    ...assets.stock.items.map((item) => ({
      label: `${goodLabel(item.category)} — ${item.amount} × ${formatEuro(item.unitCost)}`,
      amount: item.value,
      kind: 'detail',
    })),
    { label: 'Créances (411)', amount: assets.receivables, note: 'Ce qu’on doit à la SCI et qu’elle n’a pas encore encaissé : les loyers de local impayés' },
    { label: 'Trésorerie (512)', amount: assets.cash },
  ];
  const liabilityRows = [
    { label: 'Capital (101)', amount: liabilities.capital, note: 'Pour la SCI propriétaire : l’apport en nature de la ville, qui a payé la construction des bâtiments' },
    { label: 'Report à nouveau (110/119)', amount: liabilities.carriedResult, note: 'Les résultats des années passées, restés dans l’entreprise' },
    { label: 'Résultat de l’exercice', amount: liabilities.yearResult, note: 'Le résultat de l’année en cours : celui du compte de résultat, stock et amortissement inclus' },
    { label: 'Variation de stock en cours', amount: liabilities.stockVariation, note: 'Ce que le stock a changé depuis la dernière clôture du mois : ce qui est en rayon n’est pas encore une charge. Les clôtures passent le reste dans les résultats.' },
    { label: 'Dividendes versés (457)', amount: liabilities.distributions },
    { label: 'Capitaux propres', amount: liabilities.equity, kind: 'subtotal' },
    { label: 'Emprunts (164)', amount: liabilities.loans },
    { label: 'Concours bancaires courants (519)', amount: liabilities.overdraft, note: 'Le compte est sous zéro : ce qui n’a pas de créancier (les achats, l’entretien) est payé tout de même, et le compte se creuse' },
    ...Object.entries(liabilities.payables).map(([account, amount]) => ({
      label: `${accountLabelOf(account)} (${account})`,
      amount,
      note: 'Dû et pas encore payé, faute d’argent : réglé dès que la caisse le permet, les salaires d’abord',
    })),
  ];

  const wrapper = el('div', 'building-finance-statement balance-sheet');
  wrapper.append(
    sideTable('Actif', assetRows, assets.total),
    sideTable('Passif', liabilityRows, liabilities.total),
    el('p', 'building-finance-note', 'Le bilan est celui d’aujourd’hui. Le stock et l’amortissement sont passés chaque mois par la clôture des comptes. Un salaire, une cotisation, un impôt ou un loyer que l’entreprise ne peut pas payer devient une dette, réglée plus tard. Les bâtiments appartiennent à la SCI de la maison-mairie ; les autres entreprises les louent.'),
  );
  return wrapper;
}
