import { balanceSheetView } from './balanceSheetView.js';
import { accountLedgerView, trialBalanceView } from './accountLedgerView.js';
import { labelCells } from './stackableTable.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../../../../shared/building-identity/index.js';
import { INCOME_STATEMENT } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';
import { HOUSEHOLD_CONSUMPTION_GROUPS, householdConsumptionGroupOf } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { buildingName, goodLabel } from '../../shell/CatalogVocabulary.js';
import { administratorPayNotice } from '../../shell/administratorPayNotice.js';
import { houseEnterprises } from '../../../../shared/population/workforceQueries.js';
import { legalFormOf } from '../../../../shared/accounting-catalog/LegalFormCatalog.js';import { houseSeeksWork } from '../../../../shared/population/workforceQueries.js';

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
 * @param {{ allocation: string, retained: string, dividend: { toAssociates: string } } | null} terms the jargon of the legal form of a house's enterprise
 *   (LegalFormCatalog.js); null for a company, which has no allocation to show
 * @returns {ReadonlyArray<StatementRow>}
 */
function companyStatementRows(terms) {
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

    // An enterprise's allocation of its result, under the net result and outside the statement: the residents' share is already a charge (691).
    // Worded by its legal form (a house's enterprise); a company has no allocation.
    ...(terms
      ? [
          { label: terms.allocation, kind: 'section', optional: true },
          { label: terms.dividend.toAssociates, kind: 'line', optional: true, accounts: '457', tone: 'financial', amount: (f) => f.allocation.dividends },
          { label: terms.retained, kind: 'line', optional: true, amount: (f) => f.allocation.retained },
        ]
      : []),

    { label: 'Indicateur', kind: 'section' },
    { label: 'Marge commerciale (ventes de marchandises − achats − frais accessoires − transports sur achats)', kind: 'indicator', amount: (f) => f.statement.commercialMargin },
    { label: 'Taux de marge commerciale', kind: 'rate', rate: (f) => rate(f.statement.commercialMargin, f.statement.goodsSold) },
  ];
}

const COMPANY_ROWS = companyStatementRows(null);

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

    { label: 'Pertes de stock (analytique)', kind: 'section' },
    { label: 'Unités avariées', kind: 'line', optional: true, amount: (f) => f.spoilage.units, text: (f) => String(Math.round(f.spoilage.units)), hint: "Stock qui a dépassé sa durée de vie et a été jeté. Hors journal : aucune écriture, aucun effet sur la trésorerie" },
    { label: 'Manque à gagner', kind: 'line', optional: true, amount: (f) => f.spoilage.lostRevenue, text: (f) => (f.spoilage.lostRevenue === 0 ? '—' : formatEuro(f.spoilage.lostRevenue)), hint: "Unités avariées × prix de vente du bâtiment : ce qu'elles auraient rapporté. Un coût d'opportunité, jamais une charge du compte de résultat" },

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
/** A household's disposable income: what it earned less the levies it owes (taxes and social contributions). */
const disposableIncomeOf = (f) =>
  f.wagesReceived + f.publicWageReceived + f.benefitReceived + f.participationReceived + f.dividendReceived + f.incomeTaxRefunded
  - (f.incomeTax + f.citizenTax + f.employeeContributionPaid);

/**
 * A household is not a company: no PCG compte de résultat. Its account follows the national accounts' sequence for the household sector
 * (SEC 2010): revenues, compulsory levies, disposable income, final consumption, and what is left is saving. The PCG's wording and account
 * numbers stay where a company-side line mirrors one (a wage is a 421 for the employer who pays it).
 * What the household receives from its enterprises is worded by their legal forms (LegalFormCatalog.js): a cooperative pays a participation and
 * dividends, a property company distributions and no participation. The household's account does not tell the enterprises apart, so a line
 * carries the word of each form that has one, followed by the enterprise.
 * @param {ReadonlyArray<{ id: string, label: string }>} enterprises the enterprises of the house
 */
const personalRowsOf = (enterprises) => {
  const wording = (pick) =>
    enterprises
      .map((enterprise) => {
        const term = pick(legalFormOf(enterprise.id).terms);
        return term ? `${term.name} · ${enterprise.label}` : null;
      })
      .filter(Boolean)
      .join(' / ');
  const participation = wording((terms) => terms.participation);
  const dividend = wording((terms) => terms.dividend);
  return [
  { label: 'Revenus', kind: 'section', flow: 'income' },
  { label: 'Salaires perçus', kind: 'line', flow: 'income', amount: (f) => f.wagesReceived },
  { label: 'Salaire de fonctionnaire perçu', kind: 'line', flow: 'income', amount: (f) => f.publicWageReceived },
  { label: 'Allocation chômage perçue', kind: 'line', flow: 'income', amount: (f) => f.benefitReceived },
  ...(participation ? [{ label: participation, kind: 'line', flow: 'income', amount: (f) => f.participationReceived }] : []),
  { label: dividend, kind: 'line', flow: 'income', amount: (f) => f.dividendReceived },
  // An advance of income tax that went beyond the tax of the year, given back at its close.
  { label: 'Impôt sur le revenu remboursé', kind: 'line', flow: 'income', optional: true, amount: (f) => f.incomeTaxRefunded },
  { label: 'Total revenus', kind: 'subtotal', amount: (f) => f.wagesReceived + f.publicWageReceived + f.benefitReceived + f.participationReceived + f.dividendReceived + f.incomeTaxRefunded },

  { label: 'Prélèvements obligatoires', kind: 'section', flow: 'charge' },
  { label: 'Impôt sur le revenu', kind: 'line', flow: 'charge', amount: (f) => f.incomeTax },
  { label: 'Impôt citoyen', kind: 'line', flow: 'charge', amount: (f) => f.citizenTax },
  { label: 'Cotisations salariales', kind: 'line', flow: 'charge', amount: (f) => f.employeeContributionPaid },
  { label: 'Total prélèvements', kind: 'subtotal', amount: (f) => f.incomeTax + f.citizenTax + f.employeeContributionPaid },

  { label: 'Revenu disponible', kind: 'subtotal', hint: 'Revenus − prélèvements obligatoires', amount: (f) => disposableIncomeOf(f) },

  { label: 'Consommation finale', kind: 'section', flow: 'charge' },
  // A line with a `detailKey` opens the table of the purchases it adds up (see `detailTable`).
  { label: 'Services payés', kind: 'line', flow: 'charge', amount: (f) => f.servicesPaid, detailKey: 'services' },
  { label: 'Biens achetés', kind: 'line', flow: 'charge', amount: (f) => f.goodsBought, detailKey: 'goods' },
  { label: 'Loyer', kind: 'line', flow: 'charge', amount: (f) => f.rentPaid, optional: true },
  { label: 'Total consommation', kind: 'subtotal', amount: (f) => f.servicesPaid + f.goodsBought + f.rentPaid },

  { label: 'Épargne', kind: 'total', hint: 'Revenu disponible − consommation', amount: (f) => f.householdResult },

  { label: 'Report à nouveau', kind: 'section' },
  { label: 'Ouverture', kind: 'line', amount: (f) => f.openingBalance },
  { label: 'Clôture', kind: 'total', amount: (f) => f.closingBalance },
  ];
};

/**
 * The sub-tabs of a house: its personal account first, then one per enterprise it runs (each a legal person with its own account, read as a
 * company's), named by its form as the catalog gives it and in the catalog's order.
 * @param {string} buildingType
 * @param {{ businessAccountOf: (enterpriseId: string) => string }} accounting names the account of an enterprise
 */
function houseAccountsOf(buildingType, accounting) {
  const { enterprises } = houseEnterprises(buildingType);
  return [
    { kind: 'particulier', label: 'Particulier', rows: personalRowsOf(enterprises) },
    ...enterprises.map((enterprise) => ({ kind: accounting.businessAccountOf(enterprise.id), label: enterprise.label, rows: companyStatementRows(legalFormOf(enterprise.id).terms) })),
  ];
}

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
  openedDetail = null;

  if (resolveBuildingKind(model.buildingType) !== BUILDING_KIND_HOUSE) {
    await renderAccount(container, model, null, COMPANY_ROWS);
    return;
  }

  const tabs = el('div', 'building-finance-accounts');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'building-finance-body');
  let request = 0;
  const buttons = houseAccountsOf(model.buildingType, model.accounting).map((account) => {
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
  let administratorPay = null;
  try {
    finance = await model.accounting.getBuildingFinance(model.buildingId, accountKind, { month: viewedMonth, year: viewedYear });
    // The administrators' house lives on the stipend the player sets: its account says at once whether that stipend is too low.
    if (isPersonal && !houseSeeksWork(model.buildingType)) administratorPay = await model.accounting.getAdministratorPayStatus();
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
  const showContent = () => {
    // A household's purchase line opened: the table of what it adds up, until the player goes back.
    if (isPersonal && openedDetail) {
      content.replaceChildren(detailTable(openedDetail, figures, () => {
        openedDetail = null;
        showContent();
      }));
      return;
    }
    const openDetail = (detail) => {
      openedDetail = detail;
      showContent();
    };
    if (!isPersonal && DERIVED_READINGS[financeView]) {
      showDerivedReading(financeView);
      return;
    }
    content.replaceChildren(isPersonal || financeView === 'statement' ? statementTable(rows, figures, openDetail) : statementTable(RATIO_ROWS, figures));
  };
  // The balance sheet is the account as it stands now, whichever month is picked: it is read on its own, and says why when it cannot be drawn.
  const showDerivedReading = async (reading) => {
    content.replaceChildren(el('p', 'building-finance-note', '…'));
    try {
      const view = await DERIVED_READINGS[reading].load(model.accounting, model.buildingId, accountKind);
      if (stillCurrent() && financeView === reading) content.replaceChildren(view);
    } catch (error) {
      console.error(`[BuildingFinanceTab] ${reading} failed:`, error);
      if (stillCurrent()) content.replaceChildren(el('p', 'building-finance-note', `${DERIVED_READINGS[reading].label} n’est pas disponible : ${error.message}`));
    }
  };
  showContent();
  container.replaceChildren(
    ...(administratorPay ? [administratorPayNotice(administratorPay)] : []),
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
    ...(isPersonal && finance.rentDebt > 0 ? [cashLine('Dette de loyer', finance.rentDebt)] : []),
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
/** The household purchase line opened as a table (`{ key, label }`), or null on the statement (a per-viewer convenience, not game state). */
let openedDetail = null;

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

/** Which reading of a company's account is open (a per-viewer convenience, not game state). */
let financeView = 'statement';

/**
 * The readings the accounting context derives from the journal at display time, each read on its own (they are the account as it stands now, whichever
 * month is picked) and each saying why it cannot be drawn: the balance sheet, the grand livre and the balance.
 */
const DERIVED_READINGS = Object.freeze({
  balance: Object.freeze({
    label: 'Le bilan',
    load: async (accounting, buildingId, accountKind) => balanceSheetView(await accounting.getBuildingBalanceSheet(buildingId, accountKind)),
  }),
  ledger: Object.freeze({
    label: 'Le grand livre',
    load: async (accounting, buildingId, accountKind) => accountLedgerView((await accounting.getBuildingLedger(buildingId, accountKind)).ledger),
  }),
  trial: Object.freeze({
    label: 'La balance',
    load: async (accounting, buildingId, accountKind) => trialBalanceView((await accounting.getBuildingLedger(buildingId, accountKind)).balance),
  }),
});

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
    const readings = [['statement', 'Compte de résultat'], ['ratios', 'Ratios'], ['balance', 'Bilan'], ['ledger', 'Grand livre'], ['trial', 'Balance']];
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
function statementTable(rows, finance, onOpenDetail = null) {
  const wrapper = el('div', 'building-finance-statement');
  const table = el('table', 'building-finance-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const columnList = columnsOf(finance);
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
    const th = el('th', null, row.detailKey && onOpenDetail ? '' : row.label);
    if (row.detailKey && onOpenDetail) {
      // A line that adds up purchases opens the table of them.
      const link = el('button', 'building-finance-detail-link', `${row.label} ›`);
      link.type = 'button';
      link.title = 'Voir le détail';
      link.addEventListener('click', () => onOpenDetail({ key: row.detailKey, label: row.label }));
      th.append(link);
    }
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
  labelCells(table);
  // A statement that hides lines offers to show them all, and back: the choice is kept while the player moves between buildings.
  if (!rows.some((row) => row.optional)) return table;
  const toggle = el('button', 'building-finance-toggle', showAllLines ? 'Voir moins' : 'Voir tout');
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    showAllLines = !showAllLines;
    toggle.textContent = showAllLines ? 'Voir moins' : 'Voir tout';
    fill();
    labelCells(table);
  });
  wrapper.append(toggle, table);
  return wrapper;
}

/**
 * The columns of the table: the month columns by default, the year pill swaps them for last year and this year so far (the PCG's N-1 and N).
 * @param {{ scope?: string, years?: { previous: number | null, current: number }, lastMonth: object | null, monthToDate: object }} finance
 * @returns {Array<{ label: string, figures: object }>}
 */
function columnsOf(finance) {
  if (finance.scope === 'year') {
    return [
      ...(finance.lastMonth ? [{ label: `Année ${finance.years.previous}`, figures: finance.lastMonth }] : []),
      { label: `Année ${finance.years.current} (en cours)`, figures: finance.monthToDate },
    ];
  }
  return [{ label: 'Mois dernier', figures: finance.lastMonth }, { label: 'Cumul du mois', figures: finance.monthToDate }];
}

/**
 * The table of what a household's purchase line adds up: one row per journal line (the tour it was paid, what it was), with the same columns as
 * the account, and a way back to it. A purchase counted in both columns shows in both.
 * @param {{ key: 'services' | 'goods', label: string }} detail
 * @param {{ scope?: string, years?: object, lastMonth: object | null, monthToDate: object }} finance
 * @param {() => void} back
 */
function detailTable(detail, finance, back) {
  const wrapper = el('div', 'building-finance-statement building-finance-detail');
  const backButton = el('button', 'building-finance-back', '‹ Retour au compte');
  backButton.type = 'button';
  backButton.addEventListener('click', back);

  const columnList = columnsOf(finance);
  const table = el('table', 'building-finance-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of [detail.label, ...columnList.map((column) => column.label)]) {
    const th = el('th', null, label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);

  // One row per journal line, in the order they were paid, with its amount in each column that counts it.
  const purchases = new Map();
  columnList.forEach((column, index) => {
    for (const purchase of column.figures.details[detail.key]) {
      const known = purchases.get(purchase.id) ?? { ...purchase, amounts: columnList.map(() => null) };
      known.amounts[index] = purchase.amount;
      purchases.set(purchase.id, known);
    }
  });
  const body = document.createElement('tbody');
  const ordered = [...purchases.values()].sort((a, b) => a.turn - b.turn || a.id - b.id);
  // The purchases are grouped by what the household used them for (the catalog's consumption groups, in the order it lists them), each group
  // opening with its own total.
  const byGroup = new Map(HOUSEHOLD_CONSUMPTION_GROUPS.map((group) => [group.id, { group, purchases: [] }]));
  for (const purchase of ordered) byGroup.get(householdConsumptionGroupOf(purchase.resource).id).purchases.push(purchase);
  for (const { group, purchases: inGroup } of byGroup.values()) {
    if (inGroup.length === 0) continue;
    const header = el('tr', 'building-finance-row building-finance-row--subtotal');
    const title = el('th', null, group.label);
    title.scope = 'rowgroup';
    title.append(el('span', 'building-finance-pill', group.coicop));
    header.append(title);
    columnList.forEach((_, index) => {
      const cents = inGroup.reduce((sum, purchase) => sum + (purchase.amounts[index] === null ? 0 : Math.round(purchase.amounts[index] * 100)), 0);
      header.append(el('td', null, formatEuro(cents / 100)));
    });
    body.append(header);
    for (const purchase of inGroup) {
      const tr = el('tr', 'building-finance-row building-finance-row--line building-finance-flow--charge');
      // The journal's wording of the line, without the month it ends with (the columns say the period).
      const th = el('th', null, `Tour ${purchase.turn} — ${purchase.description.replace(/\s-\s[^-]+$/, '')}`);
      th.scope = 'row';
      tr.append(th);
      for (const amount of purchase.amounts) tr.append(el('td', null, amount === null ? '' : formatEuro(amount)));
      body.append(tr);
    }
  }
  if (ordered.length === 0) {
    const tr = el('tr', 'building-finance-row');
    const td = el('td', null, 'Aucun achat sur cette période.');
    td.colSpan = columnList.length + 1;
    tr.append(td);
    body.append(tr);
  }
  const totalRow = el('tr', 'building-finance-row building-finance-row--subtotal');
  totalRow.append(el('th', null, `Total ${detail.label.toLowerCase()}`));
  for (const column of columnList) {
    const cents = column.figures.details[detail.key].reduce((sum, purchase) => sum + Math.round(purchase.amount * 100), 0);
    totalRow.append(el('td', null, formatEuro(cents / 100)));
  }
  body.append(totalRow);

  table.append(head, body);
  labelCells(table);
  wrapper.append(backButton, table);
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
