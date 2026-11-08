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

/** One table: a title, its rows (`{ label, amount, kind?, note?, tone?, pill? }`: `pill` the account number, tinted by `tone`), and its total. Shared with the city's balance sheet, which reads the same. */
export function sideTable(title, rows, total, { titleHelp = null } = {}) {
  const table = el('table', 'building-finance-table balance-sheet-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const th = el('th', null, title);
  // A "?" (HelpButton.js) after the title, or after a row's label (`row.help`), where what is shown is not obvious.
  if (titleHelp) th.append(titleHelp);
  th.scope = 'col';
  th.colSpan = 2;
  headRow.append(th);
  head.append(headRow);

  const body = document.createElement('tbody');
  for (const row of [...rows, { label: `Total ${title.toLowerCase()}`, amount: total, kind: 'total' }]) {
    const tr = el('tr', `balance-sheet-row${row.kind ? ` balance-sheet-row--${row.kind}` : ''}`);
    // The family of the account (the journal's colours) tints its number, shown as a small pill after the label.
    if (row.tone) tr.dataset.tone = row.tone;
    const label = el('th', null, row.label);
    label.scope = 'row';
    if (row.note) label.title = row.note;
    if (row.pill) label.append(el('span', 'building-finance-pill', row.pill));
    if (row.help) label.append(row.help);
    tr.append(label, el('td', 'balance-sheet-amount', row.amount === null ? '' : formatEuro(row.amount)));
    body.append(tr);
  }
  table.append(head, body);
  return table;
}

const COMPANY_NOTE = 'Le bilan est celui d’aujourd’hui. Le stock et l’amortissement sont passés chaque mois par la clôture des comptes. Un salaire, une cotisation, un impôt ou un loyer que l’entreprise ne peut pas payer devient une dette, réglée plus tard. Les bâtiments appartiennent à la SCI de la maison-mairie ; les autres entreprises les louent.';

/**
 * @param {ReturnType<import('../../../../contexts/accounting/domain/policies/BalanceSheetPolicy.js').balanceSheetOf>} sheet
 * @param {{ onlyHeld?: boolean, note?: string }} [options] `onlyHeld`: only the lines that hold something (the central bank has no stock, no buildings...), the equity always;
 *   `note`: the sentence under the tables, when the sheet is not a company's
 * @returns {HTMLElement}
 */
export function balanceSheetView(sheet, { onlyHeld = false, note = COMPANY_NOTE } = {}) {
  const { assets, liabilities } = sheet;
  const shown = (rows) => (onlyHeld ? rows.filter((row) => row.kind === 'subtotal' || Math.abs(row.amount) > 0) : rows);
  const assetRows = [
    { label: 'Immobilisations (213)', amount: assets.fixedAssets, note: 'Constructions, au coût' },
    { label: 'Amortissements (281)', amount: -assets.accumulatedDepreciation, note: 'Ce que les constructions ont perdu de leur valeur depuis leur construction' },
    { label: 'Prêts (274)', amount: assets.loansLent },
    { label: 'Réserves à la banque centrale (5151)', amount: assets.reserves, note: 'La monnaie de la banque : son compte à la banque centrale, d’où partent ses paiements hors de la banque' },
    { label: 'Avoirs en devises (2761)', amount: assets.foreignReserves, note: 'L’argent venu de l’étranger, converti par la banque centrale (sous zéro quand plus a été payé à l’étranger que reçu)' },
    { label: 'Dotation de fondation de l’État (2768)', amount: assets.stateEndowment, note: 'La monnaie que la banque centrale a créée une fois pour l’État, à sa fondation' },
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
    { label: 'Dépôts de la clientèle (165)', amount: liabilities.deposits, note: 'Ce que la banque doit à ceux qui lui ont confié leur épargne : leur argent est dans sa caisse, mais il leur revient' },
    { label: 'Dépôts à vue de la clientèle (1651)', amount: liabilities.sightDeposits, note: 'L’argent des ménages et des entreprises : ce que la banque leur doit' },
    { label: 'Réserves des banques (1673)', amount: liabilities.reservesHeld, note: 'Ce que la banque centrale doit aux banques : leurs comptes chez elle' },
    { label: 'Compte du Trésor (1674)', amount: liabilities.treasuryAccount, note: 'L’argent de l’État, tenu par la banque centrale : ce qu’elle lui doit' },
    { label: 'Monnaie émise (1678)', amount: liabilities.issuedMoney, note: 'Ce que la banque centrale a créé pour refinancer la banque : la monnaie disparaît quand la banque rembourse' },
    { label: 'Concours bancaires courants (519)', amount: liabilities.overdraft, note: 'Le compte est sous zéro : ce qui n’a pas de créancier (les achats, l’entretien) est payé tout de même, et le compte se creuse' },
    ...Object.entries(liabilities.payables).map(([account, amount]) => ({
      label: `${accountLabelOf(account)} (${account})`,
      amount,
      note: 'Dû et pas encore payé, faute d’argent : réglé dès que la caisse le permet, les salaires d’abord',
    })),
  ];

  const wrapper = el('div', 'building-finance-statement balance-sheet');
  wrapper.append(
    sideTable('Actif', shown(assetRows), assets.total),
    sideTable('Passif', shown(liabilityRows), liabilities.total),
    el('p', 'building-finance-note', note),
  );
  return wrapper;
}
