import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../../../../shared/building-identity/index.js';

/**
 * The Finances tab of a building: its simplified analytical account, for the last month and for the year so far, and its
 * cash. Every figure is read from the journal by the accounting context (getBuildingFinance). The accounting words are
 * written here on purpose; the building's name is not used.
 *
 * A company has one account. A house has two: its personal account (the wages it receives, the services and goods it
 * pays) and its business account (what it sells, as goods or as deals), each shown in its own sub-tab.
 */

const signed = (amount) => (amount === 0 ? 0 : -amount);
const rate = (part, base) => (base > 0 ? `${Math.round((part / base) * 100)} %` : '—');

/**
 * @typedef {{ label: string, kind: 'line' | 'subtotal' | 'total', amount: (f: object) => number }
 *   | { label: string, kind: 'rate', rate: (f: object) => string }} StatementRow
 */

/** @type {ReadonlyArray<StatementRow>} */
const COMPANY_ROWS = [
  { label: 'Ventes HT', kind: 'line', flow: 'income', amount: (f) => f.revenueHT },
  { label: 'Achats de marchandises HT', kind: 'line', flow: 'charge', amount: (f) => signed(f.purchasesHT) },
  { label: 'Marge brute', kind: 'subtotal', amount: (f) => f.grossMargin },
  { label: 'Taux de marge brute', kind: 'rate', rate: (f) => rate(f.grossMargin, f.revenueHT) },
  { label: 'Subvention reçue', kind: 'line', flow: 'income', amount: (f) => f.subsidiesReceived },
  { label: 'Salaires des ouvriers', kind: 'line', flow: 'charge', amount: (f) => signed(f.wages) },
  { label: 'Entretien du bâtiment', kind: 'line', flow: 'charge', amount: (f) => signed(f.upkeep) },
  { label: "Résultat d'exploitation", kind: 'subtotal', amount: (f) => f.operatingResult },
  { label: 'Impôt sur les sociétés', kind: 'line', flow: 'charge', amount: (f) => signed(f.corporateTax) },
  { label: 'Résultat net', kind: 'total', amount: (f) => f.netResult },
];

/** The personal account of a house: what it earns and what it pays for its own needs. */
/** @type {ReadonlyArray<StatementRow>} */
const PERSONAL_ROWS = [
  { label: 'Salaires perçus', kind: 'line', flow: 'income', amount: (f) => f.wagesReceived },
  { label: 'Services payés', kind: 'line', flow: 'charge', amount: (f) => signed(f.servicesPaid) },
  { label: 'Biens achetés', kind: 'line', flow: 'charge', amount: (f) => signed(f.goodsBought) },
  { label: 'Résultat net', kind: 'total', amount: (f) => f.householdResult },
];

/** The sub-tabs of a house: its personal account first, then its business account (read as a company's). */
const HOUSE_ACCOUNTS = Object.freeze([
  { kind: 'particulier', label: 'Particulier', rows: PERSONAL_ROWS },
  { kind: 'entreprise', label: 'Entreprise', rows: COMPANY_ROWS },
]);

/**
 * @param {HTMLElement} container
 * @param {{ accounting: { getBuildingFinance: (buildingId: string, accountKind: string | null) => Promise<{ lastMonth: object, year: object, cash: number }> }, buildingId: string, buildingType: string } | null} model
 */
export async function renderBuildingFinanceTab(container, model) {
  container.replaceChildren();
  if (!model) return;

  if (resolveBuildingKind(model.buildingType) !== BUILDING_KIND_HOUSE) {
    await renderAccount(container, model, null, COMPANY_ROWS);
    return;
  }

  const tabs = el('div', 'building-finance-accounts');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'building-finance-body');
  let request = 0;
  const buttons = HOUSE_ACCOUNTS.map((account) => {
    const button = el('button', 'building-finance-account-tab', account.label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => {
      buttons.forEach((other) => {
        const active = other === button;
        other.classList.toggle('active', active);
        other.setAttribute('aria-selected', String(active));
      });
      const token = ++request;
      body.replaceChildren(el('p', 'building-finance-note', '…'));
      renderAccount(body, model, account.kind, account.rows, () => token === request);
    });
    tabs.append(button);
    return button;
  });
  container.append(tabs, body);
  buttons[0].click();
}

/**
 * One account's statement: its table, its cash and the note on settlement.
 * @param {HTMLElement} container
 * @param {{ accounting: { getBuildingFinance: (buildingId: string, accountKind: string | null) => Promise<{ lastMonth: object, year: object, cash: number }> }, buildingId: string }} model
 * @param {string | null} accountKind
 * @param {ReadonlyArray<StatementRow>} rows
 * @param {() => boolean} [stillCurrent] false once the user has moved to another sub-tab
 */
async function renderAccount(container, model, accountKind, rows, stillCurrent = () => true) {
  container.replaceChildren(el('p', 'building-finance-note', '…'));
  let finance;
  try {
    finance = await model.accounting.getBuildingFinance(model.buildingId, accountKind);
  } catch (error) {
    console.error('[BuildingFinanceTab] getBuildingFinance failed:', error);
    if (stillCurrent()) container.replaceChildren(el('p', 'building-finance-note', 'Les finances de ce bâtiment ne sont pas disponibles.'));
    return;
  }
  if (!stillCurrent()) return;
  container.replaceChildren(
    ...(finance.budget ? [budgetBlock(finance.budget)] : []),
    statementTable(rows, finance),
    ...(finance.openingSavings !== null ? [reconciliationBlock(finance)] : []),
    cashLine(finance.cash),
    el('p', 'building-finance-note', "Les ventes et les charges d'un mois sont réglées le premier jour du mois suivant : « Mois dernier » est donc l'activité du mois précédent."),
  );
}

/**
 * @param {ReadonlyArray<StatementRow>} rows
 * @param {{ lastMonth: object, year: object }} finance
 */
function statementTable(rows, finance) {
  const table = el('table', 'building-finance-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['', 'Mois dernier', "Cumul de l'année"]) {
    const th = el('th', null, label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = el('tr', `building-finance-row building-finance-row--${row.kind}${row.flow ? ` building-finance-flow--${row.flow}` : ''}`);
    const th = el('th', null, row.label);
    th.scope = 'row';
    tr.append(th);
    for (const figures of [finance.lastMonth, finance.year]) {
      if (row.kind === 'rate') {
        tr.append(el('td', null, row.rate(figures)));
        continue;
      }
      const amount = row.amount(figures);
      tr.append(el('td', amount < 0 ? 'is-negative' : null, formatEuro(amount)));
    }
    body.append(tr);
  }

  table.append(head, body);
  return table;
}

/**
 * What a house keeps is savings while it is positive, and a debt once it is negative: the word follows the sign.
 * @param {number} amount the balance
 * @param {string} rest what follows the word (e.g. "reportée")
 */
function savingsLabel(amount, rest) {
  return `${amount < 0 ? 'Dette' : 'Épargne'} ${rest}`;
}

/**
 * A house's month, as it buys: the savings brought forward, the salary of the month before and its services (both settled
 * on the first day), what it has bought since, and what it keeps at the end. Read from the journal, never stored.
 * @param {{ carried: number, wages: number, services: number, purchases: number, budget: number, saved: number }} budget
 */
function budgetBlock(budget) {
  const block = el('div', 'building-finance-budget');
  block.setAttribute('role', 'group');
  block.setAttribute('aria-label', 'Budget du mois');
  const lines = [
    [savingsLabel(budget.carried, 'reportée'), budget.carried, null],
    ['Salaire du mois dernier', budget.wages, 'building-finance-flow--income'],
    ['Services du mois dernier', signed(budget.services), 'building-finance-flow--charge'],
    ["Budget d'achat du mois", budget.budget, 'building-finance-row--subtotal'],
    ['Achats ce mois', signed(budget.purchases), 'building-finance-flow--charge'],
    [savingsLabel(budget.saved, 'à reporter'), budget.saved, 'building-finance-row--total'],
  ];
  for (const [label, amount, kind] of lines) {
    const row = el('div', `building-finance-budget-row${kind ? ` ${kind}` : ''}`);
    const value = el('span', amount < 0 ? 'is-negative' : null, formatEuro(amount));
    row.append(el('span', null, label), value);
    block.append(row);
  }
  return block;
}

/**
 * A house's savings add up: the savings it had at the start of the year, plus the year's result, is the cash it holds now.
 * Said here so the player never reads the year's result as the cash.
 * @param {{ openingSavings: number, year: { householdResult: number }, cash: number }} finance
 */
function reconciliationBlock(finance) {
  const block = el('div', 'building-finance-budget');
  block.setAttribute('role', 'group');
  block.setAttribute('aria-label', "Épargne de l'année");
  const lines = [
    [savingsLabel(finance.openingSavings, 'au 1er janvier'), finance.openingSavings, null],
    ["+ Résultat net de l'année", finance.year.householdResult, null],
    ['= Trésorerie à ce jour', finance.cash, 'building-finance-row--total'],
  ];
  for (const [label, amount, kind] of lines) {
    const row = el('div', `building-finance-budget-row${kind ? ` ${kind}` : ''}`);
    row.append(el('span', null, label), el('span', amount < 0 ? 'is-negative' : null, formatEuro(amount)));
    block.append(row);
  }
  return block;
}

/** The cash in the till: the balance of the account, which is not the year's result. */
function cashLine(cash) {
  const line = el('div', 'building-finance-cash');
  line.append(el('span', null, 'Trésorerie du compte à ce jour'), el('strong', null, formatEuro(cash)));
  return line;
}

/**
 * @param {string} tag
 * @param {string | null} className
 * @param {string} [text]
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
