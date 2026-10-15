import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../../../../shared/building-identity/index.js';
import { INCOME_STATEMENT } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';
import { buildingName, goodLabel } from '../../shell/CatalogVocabulary.js';

/**
 * The Finances tab of a building: its simplified analytical account, for the last month and for the year so far, and its
 * cash. Every figure is read from the journal by the accounting context (getBuildingFinance). The accounting words are
 * written here on purpose; the building's name is not used.
 *
 * A company has one account. A house has two: its personal account (the wages it receives, the services and goods it
 * pays) and its business account (what it sells, as goods or as deals), each shown in its own sub-tab.
 */

/** Whether the statement lists every line of the model, the nil ones too (a per-viewer convenience, not game state). */
let showAllLines = false;

const rate = (part, base) => (base > 0 ? `${Math.round((part / base) * 100)} %` : '—');

/**
 * A compte de résultat: produits grouped together, then charges grouped together — never alternated — each with
 * its own subtotal, a margin indicator where one is meaningful, then the net result. Charges show their natural
 * (positive) amount: the section they sit under already says they are subtracted, so there is no sign to flip.
 * @typedef {{ label: string, kind: 'section', flow?: 'income' | 'charge' }
 *   | { label: string, kind: 'line' | 'subtotal' | 'total' | 'indicator', flow?: 'income' | 'charge', optional?: boolean, lineId?: string, tone?: string, accounts?: string, hint?: string, amount?: (f: object) => number, text?: (f: object) => string }
 *   | { label: string, kind: 'rate', rate: (f: object) => string }} StatementRow
 */

/**
 * A company's account (and a house's business account) as a COMPTE DE RÉSULTAT in the model of the plan comptable: the rows are
 * generated from the statement the catalog declares (INCOME_STATEMENT), each line with the account numbers that feed it, then the
 * results in the model's order. It is read from the journal's lines, never written to it; the cash of the account is a different figure,
 * shown under the table. A line with nothing in any column is not shown (the model lists every line; the game shows the ones in use).
 * @returns {ReadonlyArray<StatementRow>}
 */
function companyStatementRows() {
  const lineAmount = (lineId) => (f) => f.statement.sections.flatMap((section) => section.lines).find((line) => line.id === lineId).amount;
  const sectionTotal = (sectionId) => (f) => f.statement.sections.find((section) => section.id === sectionId).total;
  const result = (name) => (f) => f.statement.results[name];
  const accountsOf = (line) => line.accounts.join(', ');
  // `always`: the line stays in the table when it is zero (the tax on profits: the player must see it is there, and nil).
  const lineRows = (section, flow, always = false) =>
    section.lines.map((line) => ({ label: line.label, kind: 'line', flow, optional: !always, lineId: line.id, tone: line.tone, accounts: accountsOf(line), amount: lineAmount(line.id) }));
  const byId = Object.fromEntries(INCOME_STATEMENT.map((section) => [section.id, section]));
  // A section with one line (the financial and the exceptional ones) is that one line: no header, no total.
  const single = (section, flow, always = false) => lineRows({ ...section, lines: [{ ...section.lines[0], label: section.label }] }, flow, always);

  return [
    { label: byId.operatingIncome.label, kind: 'section', flow: 'income' },
    ...lineRows(byId.operatingIncome, 'income'),
    { label: "Total des produits d'exploitation", kind: 'subtotal', amount: sectionTotal('operatingIncome') },

    { label: byId.operatingCharges.label, kind: 'section', flow: 'charge' },
    ...lineRows(byId.operatingCharges, 'charge'),
    { label: "Total des charges d'exploitation", kind: 'subtotal', amount: sectionTotal('operatingCharges') },
    { label: "1. Résultat d'exploitation", kind: 'total', amount: result('operating') },

    { label: 'Résultat financier', kind: 'section' },
    ...single(byId.financialIncome, 'income'),
    ...single(byId.financialCharges, 'charge'),
    { label: '2. Résultat financier', kind: 'total', amount: result('financial') },
    { label: '3. Résultat courant avant impôts', kind: 'total', amount: result('current') },

    { label: 'Résultat exceptionnel', kind: 'section' },
    ...single(byId.exceptionalIncome, 'income'),
    ...single(byId.exceptionalCharges, 'charge'),
    { label: '4. Résultat exceptionnel', kind: 'total', amount: result('exceptional') },

    ...single(byId.workersParticipation, 'charge'),
    ...single(byId.profitTax, 'charge', true),
    { label: 'Bénéfice ou perte', kind: 'total', amount: result('net') },

    // A cooperative's allocation of its result, under the net result and outside the statement: the residents' share is already a charge (691).
    { label: 'Affectation du résultat', kind: 'section', optional: true },
    { label: 'Dividendes versés aux associés', kind: 'line', optional: true, accounts: '457', tone: 'financial', amount: (f) => f.allocation.dividends },
    { label: 'Résultat conservé (réserves)', kind: 'line', optional: true, amount: (f) => f.allocation.retained },

    { label: 'Indicateur', kind: 'section' },
    { label: 'Marge commerciale (ventes de marchandises − achats − frais accessoires − transports sur achats)', kind: 'indicator', amount: (f) => f.statement.commercialMargin },
    { label: 'Taux de marge commerciale', kind: 'rate', rate: (f) => rate(f.statement.commercialMargin, f.statement.goodsSold) },
  ];
}

const COMPANY_ROWS = companyStatementRows();

/**
 * The management ratios of a company's account, read from its statement (BuildingFinancePolicy.ratiosOf): what a manager reads next to the
 * compte de résultat. A figure that does not exist yet (no sales: no break-even) shows "—", never a zero.
 * @type {ReadonlyArray<StatementRow>}
 */
const RATIO_ROWS = (() => {
  const euro = (pick) => (f) => (pick(f.ratios) === null ? '—' : formatEuro(pick(f.ratios)));
  const percent = (pick) => (f) => (pick(f.ratios) === null ? '—' : `${Math.round(pick(f.ratios) * 100)} %`);
  return [
    { label: 'Activité', kind: 'section' },
    { label: "Chiffre d'affaires", kind: 'line', text: euro((r) => r.turnover), hint: 'Ventes de marchandises + production vendue' },

    { label: 'Soldes intermédiaires de gestion', kind: 'section' },
    { label: 'Valeur ajoutée', kind: 'line', text: euro((r) => r.valueAdded), hint: "Chiffre d'affaires − achats − charges externes" },
    { label: 'Taux de valeur ajoutée', kind: 'line', text: percent((r) => r.valueAddedRate), hint: "Valeur ajoutée ÷ chiffre d'affaires" },
    { label: 'Coût du personnel', kind: 'line', text: euro((r) => r.labourCost), hint: "Salaires bruts + cotisations patronales" },
    { label: 'Part des salaires dans la valeur ajoutée', kind: 'line', text: percent((r) => r.labourShare), hint: "Coût du personnel ÷ valeur ajoutée : ce que la masse salariale prend de ce que le bâtiment ajoute (au-delà de 100 %, il perd de l'argent)" },
    { label: "Excédent brut d'exploitation (EBE)", kind: 'line', text: euro((r) => r.ebe), hint: "Valeur ajoutée + subventions − impôts et taxes − salaires − cotisations" },
    { label: "Résultat d'exploitation", kind: 'line', text: euro((r) => r.operatingResult), hint: "Produits − charges d'exploitation" },
    { label: 'Résultat net', kind: 'line', text: euro((r) => r.netResult), hint: 'Bénéfice ou perte, après impôt sur les bénéfices' },

    { label: 'Autofinancement', kind: 'section' },
    { label: "Capacité d'autofinancement (CAF)", kind: 'total', text: euro((r) => r.caf), hint: "Résultat net + charges non décaissées (aucun amortissement dans le jeu : c'est le résultat net)" },
    { label: 'CAF ÷ chiffre d\'affaires', kind: 'line', text: percent((r) => r.cafRate), hint: "Part de chaque euro vendu qui reste pour investir et rembourser" },

    { label: "Coût de revient d'une unité", kind: 'section' },
    { label: 'Unités vendues', kind: 'line', text: (f) => (f.ratios.unitsSold === null ? '—' : String(Math.round(f.ratios.unitsSold))), hint: "Biens ou prestations livrés le mois de l'activité (le mois qui précède le règlement)" },
    { label: 'Prix de vente moyen', kind: 'line', text: euro((r) => r.averagePrice), hint: "Chiffre d'affaires ÷ unités vendues" },
    { label: "Coût de revient par unité", kind: 'line', text: euro((r) => r.costPerUnit), hint: "Charges d'exploitation (achats, salaires, entretien…) ÷ unités vendues : c'est là que se voit le salaire" },
    { label: 'Résultat par unité', kind: 'total', text: euro((r) => r.resultPerUnit), hint: 'Prix moyen − coût de revient : négatif, chaque unité vendue perd de l\'argent' },

    { label: 'Seuil de rentabilité', kind: 'section' },
    { label: 'Charges variables', kind: 'line', text: euro((r) => r.variableCharges), hint: 'Ce qui suit les quantités vendues : achats, transports et douanes sur les biens' },
    { label: 'Charges fixes', kind: 'line', text: euro((r) => r.fixedCharges), hint: 'Salaires (dus même sans vente), entretien, autres charges externes, intérêts' },
    { label: "Subventions d'exploitation", kind: 'line', text: euro((r) => r.subsidies), hint: 'Compte 74 : non comptées dans le seuil' },
    { label: 'Autres produits hors ventes', kind: 'line', text: euro((r) => r.otherNonSalesIncome), hint: 'Produits financiers et divers : non comptés dans le seuil' },
    { label: 'Taux de marge sur coûts variables', kind: 'line', text: percent((r) => r.variableMarginRate), hint: "(Chiffre d'affaires − charges variables) ÷ chiffre d'affaires" },
    { label: 'Seuil de rentabilité', kind: 'total', text: euro((r) => r.breakEven), hint: "Chiffre d'affaires à atteindre pour ne ni gagner ni perdre : charges fixes ÷ taux de marge" },
    { label: 'Marge de sécurité', kind: 'line', text: euro((r) => r.safetyMargin), hint: "Chiffre d'affaires − seuil de rentabilité (négative : en dessous du seuil)" },
    { label: 'Indice de sécurité', kind: 'line', text: percent((r) => r.safetyIndex), hint: "Marge de sécurité ÷ chiffre d'affaires : de combien les ventes peuvent baisser" },
  ];
})();

/** The personal account of a house: what it earns and what it pays for its own needs. */
/** @type {ReadonlyArray<StatementRow>} */
const PERSONAL_ROWS = [
  { label: 'Produits', kind: 'section', flow: 'income' },
  { label: 'Salaires perçus', kind: 'line', flow: 'income', amount: (f) => f.wagesReceived },
  { label: 'Salaire de fonctionnaire perçu', kind: 'line', flow: 'income', amount: (f) => f.publicWageReceived },
  { label: 'Allocation chômage perçue', kind: 'line', flow: 'income', amount: (f) => f.benefitReceived },
  { label: 'Participation aux résultats de la coopérative', kind: 'line', flow: 'income', amount: (f) => f.participationReceived },
  { label: 'Dividendes de la coopérative', kind: 'line', flow: 'income', amount: (f) => f.dividendReceived },
  { label: 'Total produits', kind: 'subtotal', amount: (f) => f.wagesReceived + f.publicWageReceived + f.benefitReceived + f.participationReceived + f.dividendReceived },

  { label: 'Charges', kind: 'section', flow: 'charge' },
  { label: 'Services payés', kind: 'line', flow: 'charge', amount: (f) => f.servicesPaid },
  { label: 'Biens achetés', kind: 'line', flow: 'charge', amount: (f) => f.goodsBought },
  { label: 'Impôt sur le revenu', kind: 'line', flow: 'charge', amount: (f) => f.incomeTax },
  { label: 'Impôt citoyen', kind: 'line', flow: 'charge', amount: (f) => f.citizenTax },
  { label: 'Cotisations salariales', kind: 'line', flow: 'charge', amount: (f) => f.employeeContributionPaid },
  { label: 'Total charges', kind: 'subtotal', amount: (f) => f.servicesPaid + f.goodsBought + f.incomeTax + f.citizenTax + f.employeeContributionPaid },

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
 * @param {{ accounting: { getBuildingFinance: (buildingId: string, accountKind: string | null) => Promise<{ lastMonth: object, monthToDate: object, year: object, cash: number }> }, buildingId: string, buildingType: string } | null} model
 */
export async function renderBuildingFinanceTab(container, model) {
  container.replaceChildren();
  if (!model) return;
  // A tab opens on the current month; the player picks a past one with its pill.
  viewedMonth = null;
  viewedYear = false;

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
 * @param {{ accounting: { getBuildingFinance: (buildingId: string, accountKind: string | null) => Promise<{ lastMonth: object, monthToDate: object, year: object, cash: number }> }, buildingId: string }} model
 * @param {string | null} accountKind
 * @param {ReadonlyArray<StatementRow>} rows
 * @param {() => boolean} [stillCurrent] false once the user has moved to another sub-tab
 */
async function renderAccount(container, model, accountKind, rows, stillCurrent = () => true) {
  container.replaceChildren(el('p', 'building-finance-note', '…'));
  const isPersonal = accountKind === 'particulier';
  let finance;
  let bankId = null;
  let depositBalance = 0;
  try {
    finance = await model.accounting.getBuildingFinance(model.buildingId, accountKind, { month: viewedMonth, year: viewedYear });
    if (isPersonal) {
      bankId = await model.accounting.findBankBuildingId();
      if (bankId) depositBalance = await model.accounting.getHouseholdDepositBalance(model.buildingId);
    }
  } catch (error) {
    console.error('[BuildingFinanceTab] getBuildingFinance failed:', error);
    if (stillCurrent()) container.replaceChildren(el('p', 'building-finance-note', 'Les finances de ce bâtiment ne sont pas disponibles.'));
    return;
  }
  if (!stillCurrent()) return;
  const rerender = () => renderAccount(container, model, accountKind, rows, stillCurrent);
  const figures = withCarryForward(finance);
  // A company's account reads as its statement or as its ratios (a pill each); the JSON of the account is one click away.
  const content = el('div', 'building-finance-content');
  const showContent = () => content.replaceChildren(isPersonal || financeView === 'statement' ? statementTable(rows, figures) : statementTable(RATIO_ROWS, figures));
  showContent();
  container.replaceChildren(
    monthPills(finance, ({ month, year }) => {
      viewedMonth = month;
      viewedYear = year;
      rerender();
    }),
    financeToolbar(model, accountKind, isPersonal, showContent),
    content,
    cashLine(isPersonal ? 'Épargne privée' : 'Trésorerie du compte à ce jour', finance.cash),
    cashMovementsDetails(finance.cashMovements),
    ...(isPersonal ? [depositBalanceLine(depositBalance)] : []),
    ...(isPersonal && bankId ? depositControls(model, bankId, rerender) : []),
    el('p', 'building-finance-note', finance.scope === 'year'
      ? "L'année est la somme des lignes du journal de l'année ; la trésorerie ci-dessus est celle d'aujourd'hui."
      : "Les ventes et les charges d'un mois sont réglées le premier jour du mois suivant : « Mois dernier » est donc l'activité du mois précédent."),
  );
}

/** The month of this year the account is read at (null: the current one); a per-viewer convenience, not game state. */
let viewedMonth = null;
/** True when the account is read as a year state (last year next to this year so far) instead of a month. */
let viewedYear = false;

/**
 * One pill per month of the year so far, from 1 to the current month: a click reads the account as it stood at the end of that month.
 * The last pill, in another colour, is the year state: last year and this year so far.
 * @param {{ month: number | null, currentMonth: number, scope?: string }} finance
 * @param {(view: { month: number | null, year: boolean }) => void} pick month null for the current month (the last month pill)
 */
function monthPills(finance, pick) {
  const bar = el('div', 'building-finance-months');
  const isYear = finance.scope === 'year';
  for (let month = 1; month <= finance.currentMonth; month += 1) {
    const open = !isYear && month === finance.month;
    const button = el('button', `building-finance-pill-tab${open ? ' is-active' : ''}`, String(month));
    button.type = 'button';
    button.setAttribute('aria-label', `Mois ${month}`);
    button.setAttribute('aria-pressed', String(open));
    button.addEventListener('click', () => pick({ month: month === finance.currentMonth ? null : month, year: false }));
    bar.append(button);
  }
  const yearButton = el('button', `building-finance-pill-tab building-finance-pill-year${isYear ? ' is-active' : ''}`, 'Année');
  yearButton.type = 'button';
  yearButton.title = 'Année précédente et année en cours';
  yearButton.setAttribute('aria-pressed', String(isYear));
  yearButton.addEventListener('click', () => pick({ month: null, year: true }));
  bar.append(yearButton);
  return bar;
}

/** Which of the two readings of a company's account is open, the statement or its ratios (a per-viewer convenience, not game state). */
let financeView = 'statement';

/**
 * The pills that switch between the statement and the ratios, and the button that downloads the account as JSON.
 * @param {{ accounting: { exportBuildingAccountJson: (buildingId: string, accountKind: string | null) => Promise<string> }, buildingId: string, buildingType: string }} model
 * @param {string | null} accountKind
 * @param {boolean} isPersonal a household's budget has no ratios
 * @param {() => void} showContent redraws the open reading
 */
function financeToolbar(model, accountKind, isPersonal, showContent) {
  const bar = el('div', 'building-finance-toolbar');
  if (!isPersonal) {
    const pills = el('div', 'building-finance-pills');
    const readings = [['statement', 'Compte de résultat'], ['ratios', 'Ratios']];
    const buttons = readings.map(([id, label]) => {
      const button = el('button', `building-finance-pill-tab${id === financeView ? ' is-active' : ''}`, label);
      button.type = 'button';
      button.addEventListener('click', () => {
        financeView = id;
        buttons.forEach((other, index) => other.classList.toggle('is-active', readings[index][0] === id));
        showContent();
      });
      return button;
    });
    pills.append(...buttons);
    bar.append(pills);
  }
  const download = el('button', 'building-finance-download', 'JSON');
  download.type = 'button';
  download.title = 'Télécharger ce compte en JSON (compte de résultat, trésorerie et écritures du journal)';
  download.addEventListener('click', async () => {
    try {
      const json = await model.accounting.exportBuildingAccountJson(model.buildingId, accountKind);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      // The real date only stamps the file name, so two downloads never collide (the game's own dates are turns).
      const name = buildingName(model.buildingType).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      link.download = `compte-${name}-${model.buildingId.slice(0, 8)}${accountKind ? `-${accountKind}` : ''}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('[BuildingFinanceTab] export failed:', error);
      alert(`Export impossible : ${error.message}`);
    }
  });
  bar.append(download);
  return bar;
}

/**
 * A house's personal account carries its savings (or its debt) forward: what it had before a period's result is its
 * opening report à nouveau, what it has after is its closing one — the same figure a "Report à nouveau" row shows in
 * a real compte de résultat. "Mois dernier" opens on the balance before the current (still open) month's own lines
 * and closes there — "Cumul du mois" opens on that same balance and closes on the account's balance right now (it
 * is the one column still moving); the year opens on the balance at the 1st of January and closes on today's cash.
 * A company's account has no such carry-forward (`finance.budget`/`openingSavings` are null): its figures pass
 * through unchanged, and `PERSONAL_ROWS`-only rows referencing `openingBalance`/`closingBalance` are simply absent
 * from `COMPANY_ROWS`, so nothing reads the missing fields.
 * @param {{ lastMonth: object, monthToDate: object, year: object, budget: object | null, openingSavings: number | null, cash: number }} finance
 */
function withCarryForward(finance) {
  if (finance.scope === 'year') {
    // The year state: this year opens on the 1st of January's balance, which is what last year closed on.
    if (finance.openingSavings === null) return finance;
    return {
      ...finance,
      lastMonth: finance.lastMonth && {
        ...finance.lastMonth,
        openingBalance: finance.openingSavings - finance.lastMonth.householdResult,
        closingBalance: finance.openingSavings,
      },
      monthToDate: { ...finance.monthToDate, openingBalance: finance.openingSavings, closingBalance: finance.cash },
    };
  }
  if (!finance.budget) return finance;
  return {
    ...finance,
    lastMonth: {
      ...finance.lastMonth,
      openingBalance: finance.budget.carried - finance.lastMonth.householdResult,
      closingBalance: finance.budget.carried,
    },
    monthToDate: {
      ...finance.monthToDate,
      openingBalance: finance.budget.carried,
      closingBalance: finance.cash,
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
 * @param {{ lastMonth: object, monthToDate: object, year: object }} finance
 */
function statementTable(rows, finance) {
  const wrapper = el('div', 'building-finance-statement');
  const table = el('table', 'building-finance-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  // The game runs on months: the month columns are the default, the year pill swaps them for last year and this year so far (the PCG's N-1 and N).
  const isYear = finance.scope === 'year';
  const columnList = isYear
    ? [
      ...(finance.lastMonth ? [{ label: `Année ${finance.years.previous}`, figures: finance.lastMonth }] : []),
      { label: `Année ${finance.years.current} (en cours)`, figures: finance.monthToDate },
    ]
    : [{ label: 'Mois dernier', figures: finance.lastMonth }, { label: 'Cumul du mois', figures: finance.monthToDate }];
  for (const label of ['', ...columnList.map((column) => column.label)]) {
    const th = el('th', null, label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');
  const columns = columnList.map((column) => column.figures);
  // An optional line with nothing in any column is not shown, nor a section header with no line left under it, unless the
  // player asked to see everything ("Voir tout").
  const isShown = (row) => showAllLines || !row.optional || columns.some((figures) => row.amount(figures) !== 0);
  const fill = () => {
  body.replaceChildren();
  const shown = rows.filter((row, index) => {
    if (row.kind !== 'section') return isShown(row);
    for (let next = index + 1; next < rows.length && rows[next].kind !== 'section'; next += 1) {
      if (isShown(rows[next])) return true;
    }
    return false;
  });
  for (const row of shown) {
    const tr = el('tr', `building-finance-row building-finance-row--${row.kind}${row.flow ? ` building-finance-flow--${row.flow}` : ''}`);
    if (row.kind === 'section') {
      const th = el('th', null, row.label);
      th.scope = 'colgroup';
      th.colSpan = columns.length + 1;
      tr.append(th);
      body.append(tr);
      continue;
    }
    if (row.tone) tr.dataset.tone = row.tone;
    const th = el('th', null, row.label);
    if (row.accounts) th.append(el('span', 'building-finance-pill', row.accounts));
    if (row.hint) th.append(el('span', 'building-finance-hint', row.hint));
    th.scope = 'row';
    tr.append(th);
    for (const figures of columns) {
      if (row.text) {
        tr.append(el('td', null, row.text(figures)));
        continue;
      }
      if (row.kind === 'rate') {
        tr.append(el('td', null, row.rate(figures)));
        continue;
      }
      const amount = row.amount(figures);
      tr.append(el('td', amount < 0 ? 'is-negative' : null, formatEuro(amount)));
    }
    body.append(tr);
    if (row.lineId) for (const itemRow of itemRowsOf(row.lineId, columns)) body.append(itemRow);
  }
  };
  fill();

  table.append(head, body);
  // A statement that hides lines offers to show them all, and back: the choice is kept while the player moves between buildings.
  if (!rows.some((row) => row.optional)) return table;
  const toggle = el('button', 'building-finance-toggle', showAllLines ? 'Voir moins' : 'Voir tout');
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    showAllLines = !showAllLines;
    toggle.textContent = showAllLines ? 'Voir moins' : 'Voir tout';
    fill();
  });
  wrapper.append(toggle, table);
  return wrapper;
}

/**
 * What a line of the statement is made of, in small grey rows under it: the journal's own kinds of movement (what a "charge externe"
 * really is in the game), one row per kind, with its amount in each column. A kind with nothing in any column is not listed.
 * @param {string} lineId
 * @param {ReadonlyArray<{ statement: object }>} columns
 * @returns {HTMLTableRowElement[]}
 */
function itemRowsOf(lineId, columns) {
  const itemsOf = (figures) => figures.statement.sections.flatMap((section) => section.lines).find((line) => line.id === lineId).items;
  const keyOf = (item) => [item.account, item.label, item.detail ?? '', item.good ?? ''].join('|');
  const known = new Map();
  for (const figures of columns) for (const item of itemsOf(figures)) if (!known.has(keyOf(item))) known.set(keyOf(item), item);
  return [...known.entries()].map(([key, item]) => {
    const tr = el('tr', 'building-finance-row building-finance-row--item');
    tr.dataset.tone = item.tone;
    const name = `${item.detail ?? item.label}${item.good ? ` — ${goodLabel(item.good)}` : ''}`;
    const th = el('th', null, `${name} (${item.account})`);
    th.scope = 'row';
    tr.append(th);
    for (const figures of columns) {
      const amount = itemsOf(figures).find((candidate) => keyOf(candidate) === key)?.amount ?? 0;
      tr.append(el('td', null, amount === 0 ? '' : formatEuro(amount)));
    }
    return tr;
  });
}

/**
 * What the cash is made of, since the account opened: one small row per kind of movement, signed, behind a "Détail" fold (the cash
 * above is the account's balance; these are the movements that built it, not a second total).
 * @param {Array<{ account: string | null, label: string, detail: string | null, good: string | null, tone: string, amount: number }>} movements
 */
function cashMovementsDetails(movements) {
  const details = el('details', 'building-finance-cash-details');
  details.append(el('summary', null, 'Ce qui compose la trésorerie'));
  if (movements.length === 0) {
    details.append(el('p', 'building-finance-note', 'Aucun mouvement depuis l’ouverture du compte.'));
    return details;
  }
  const list = el('ul', 'building-finance-cash-list');
  for (const movement of movements) {
    const item = el('li', 'building-finance-row');
    item.dataset.tone = movement.tone;
    const name = `${movement.detail ?? movement.label}${movement.good ? ` — ${goodLabel(movement.good)}` : ''}`;
    const text = el('span', null, name);
    if (movement.account) text.append(el('span', 'building-finance-pill', movement.account));
    item.append(text, el('strong', movement.amount < 0 ? 'is-negative' : null, formatEuro(movement.amount)));
    list.append(item);
  }
  details.append(list);
  return details;
}

/** The cash in the till: the balance of the account, which is not the year's result. */
function cashLine(label, cash) {
  const line = el('div', 'building-finance-cash');
  line.append(el('span', null, label), el('strong', null, formatEuro(cash)));
  return line;
}

/**
 * What a house has at the bank — shown only on its personal account, next to its own cash, so "épargne" never
 * means one figure or the other without saying which (see DepositBalancePolicy.js: never stored, always derived).
 * @param {number} balance
 */
function depositBalanceLine(balance) {
  const line = el('div', 'building-finance-cash');
  line.append(el('span', null, 'Épargne en banque'), el('strong', null, formatEuro(balance)));
  return line;
}

/**
 * The deposit/withdraw mini-form of a house's personal account — only rendered when a bank actually exists (see
 * accounting.findBankBuildingId): no control for an action nothing can fulfil yet.
 * @param {{ accounting: object, buildingId: string }} model
 * @param {string} bankId
 * @param {() => void} onChanged re-renders the tab after a deposit/withdrawal (the balances it shows just moved)
 */
function depositControls(model, bankId, onChanged) {
  const row = el('div', 'building-finance-deposit-controls');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.step = '1';
  input.className = 'building-finance-deposit-amount';
  input.placeholder = 'Montant';
  const status = el('p', 'building-finance-note');

  const act = (action, description, failureReason) => async () => {
    const amount = Math.round(Number(input.value));
    if (!Number.isFinite(amount) || amount <= 0) {
      status.textContent = 'Indiquez un montant.';
      return;
    }
    const { turn } = await model.accounting.getTreasurySnapshot();
    const result = await action({ turn, houseId: model.buildingId, bankId, amount, description });
    if (!result.recorded) {
      status.textContent = failureReason(result.reason);
      return;
    }
    input.value = '';
    status.textContent = '';
    onChanged();
  };

  const depositBtn = el('button', 'building-finance-deposit-btn', 'Déposer');
  depositBtn.type = 'button';
  depositBtn.addEventListener('click', act(
    (params) => model.accounting.recordHouseholdDeposit(params),
    'Dépôt à la banque',
    (reason) => (reason === 'insufficient_funds' ? "Vous n'avez pas cette somme." : 'Le dépôt a échoué.'),
  ));

  const withdrawBtn = el('button', 'building-finance-deposit-btn', 'Retirer');
  withdrawBtn.type = 'button';
  withdrawBtn.addEventListener('click', act(
    (params) => model.accounting.recordHouseholdWithdrawal(params),
    'Retrait de la banque',
    (reason) => (reason === 'insufficient_deposit' ? "Vous n'avez pas autant d'épargne à la banque."
      : reason === 'bank_insufficient_funds' ? "La banque n'a pas les fonds pour ce retrait."
        : 'Le retrait a échoué.'),
  ));

  row.append(input, depositBtn, withdrawBtn);
  return [row, status];
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
