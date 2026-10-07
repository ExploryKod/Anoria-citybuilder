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

const rate = (part, base) => (base > 0 ? `${Math.round((part / base) * 100)} %` : '—');

/**
 * A compte de résultat: produits grouped together, then charges grouped together — never alternated — each with
 * its own subtotal, a margin indicator where one is meaningful, then the net result. Charges show their natural
 * (positive) amount: the section they sit under already says they are subtracted, so there is no sign to flip.
 * @typedef {{ label: string, kind: 'section' }
 *   | { label: string, kind: 'line' | 'subtotal' | 'total' | 'indicator', flow?: 'income' | 'charge', amount: (f: object) => number }
 *   | { label: string, kind: 'rate', rate: (f: object) => string }} StatementRow
 */

/** @type {ReadonlyArray<StatementRow>} */
const COMPANY_ROWS = [
  { label: 'Produits', kind: 'section' },
  { label: 'Ventes HT', kind: 'line', flow: 'income', amount: (f) => f.revenueHT },
  { label: 'Subvention reçue', kind: 'line', flow: 'income', amount: (f) => f.subsidiesReceived },
  { label: 'Total produits', kind: 'subtotal', amount: (f) => f.revenueHT + f.subsidiesReceived },

  { label: 'Charges', kind: 'section' },
  { label: 'Achats de marchandises HT', kind: 'line', flow: 'charge', amount: (f) => f.purchasesHT },
  { label: 'Salaires des ouvriers', kind: 'line', flow: 'charge', amount: (f) => f.wages },
  { label: 'Entretien du bâtiment', kind: 'line', flow: 'charge', amount: (f) => f.upkeep },
  { label: 'Impôt sur les sociétés', kind: 'line', flow: 'charge', amount: (f) => f.corporateTax },
  { label: 'Total charges', kind: 'subtotal', amount: (f) => f.purchasesHT + f.wages + f.upkeep + f.corporateTax },

  { label: 'Marge brute (ventes − achats)', kind: 'indicator', amount: (f) => f.grossMargin },
  { label: 'Taux de marge brute', kind: 'rate', rate: (f) => rate(f.grossMargin, f.revenueHT) },

  { label: 'Résultat net', kind: 'total', amount: (f) => f.netResult },
];

/** The personal account of a house: what it earns and what it pays for its own needs. */
/** @type {ReadonlyArray<StatementRow>} */
const PERSONAL_ROWS = [
  { label: 'Produits', kind: 'section' },
  { label: 'Salaires perçus', kind: 'line', flow: 'income', amount: (f) => f.wagesReceived },
  { label: 'Salaire de fonctionnaire perçu', kind: 'line', flow: 'income', amount: (f) => f.publicWageReceived },
  { label: 'Allocation chômage perçue', kind: 'line', flow: 'income', amount: (f) => f.benefitReceived },
  { label: 'Total produits', kind: 'subtotal', amount: (f) => f.wagesReceived + f.publicWageReceived + f.benefitReceived },

  { label: 'Charges', kind: 'section' },
  { label: 'Services payés', kind: 'line', flow: 'charge', amount: (f) => f.servicesPaid },
  { label: 'Biens achetés', kind: 'line', flow: 'charge', amount: (f) => f.goodsBought },
  { label: 'Impôt sur le revenu', kind: 'line', flow: 'charge', amount: (f) => f.incomeTax },
  { label: 'Total charges', kind: 'subtotal', amount: (f) => f.servicesPaid + f.goodsBought + f.incomeTax },

  { label: 'Résultat net', kind: 'total', amount: (f) => f.householdResult },

  { label: 'Report à nouveau', kind: 'section' },
  { label: 'Ouverture', kind: 'line', amount: (f) => f.openingBalance },
  { label: 'Clôture', kind: 'total', amount: (f) => f.closingBalance },
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
    statementTable(rows, withCarryForward(finance)),
    cashLine(finance.cash),
    el('p', 'building-finance-note', "Les ventes et les charges d'un mois sont réglées le premier jour du mois suivant : « Mois dernier » est donc l'activité du mois précédent."),
  );
}

/**
 * A house's personal account carries its savings (or its debt) forward: what it had before a period's result is its
 * opening report à nouveau, what it has after is its closing one — the same figure a "Report à nouveau" row shows in
 * a real compte de résultat. For the month column this is read from the budget's carried savings (the balance
 * before the still-open current month's own lines); for the year column it is the balance at the 1st of January.
 * A company's account has no such carry-forward (`finance.budget`/`openingSavings` are null): its figures pass
 * through unchanged, and `PERSONAL_ROWS`-only rows referencing `openingBalance`/`closingBalance` are simply absent
 * from `COMPANY_ROWS`, so nothing reads the missing fields.
 * @param {{ lastMonth: object, year: object, budget: object | null, openingSavings: number | null, cash: number }} finance
 */
function withCarryForward(finance) {
  if (!finance.budget) return finance;
  return {
    ...finance,
    lastMonth: {
      ...finance.lastMonth,
      openingBalance: finance.budget.carried - finance.lastMonth.householdResult,
      closingBalance: finance.budget.carried,
    },
    year: {
      ...finance.year,
      openingBalance: finance.openingSavings,
      closingBalance: finance.cash,
    },
  };
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
    if (row.kind === 'section') {
      const th = el('th', null, row.label);
      th.scope = 'colgroup';
      th.colSpan = 3;
      tr.append(th);
      body.append(tr);
      continue;
    }
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
