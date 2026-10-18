/**
 * The journal's lines read in the French chart of accounts (Plan comptable général, ANC règlement 2014-03, version 1er janvier 2026,
 * kept in docs/Plan-de-comptes-2026.pdf): each type of line says which account it belongs to, and so which family of colour it wears.
 *
 * `tone` is the colour family (the CSS tokens `--pcg…` of journal.css and the filter pills use the same names). It follows the class of
 * the account, with one rule of the player's: every tax and duty is BLUE (a lighter blue for what the city receives, a deeper blue for
 * what a company or a house pays), and the households' incomes a tender green. So a customs duty paid by an importer is a tax by tone
 * although the PCG books it with the accessory costs of the purchase (608).
 *
 *   1 capitaux, emprunts → violet     2 immobilisations → grey          4 l'État (impôts, taxes, douanes) → blue
 *   5 financiers (banques) → teal     6 charges → red / amber / orange   7 produits → green
 *
 * A household is not an entity of the PCG: its lines (wages, benefits, what it buys) are shown under the account that mirrors them in a
 * company's books, and marked `household`.
 *
 * @typedef {'capital' | 'loan' | 'loan-repayment' | 'fixed-asset' | 'tax-received' | 'tax-paid' | 'treasury' | 'purchase' | 'external'
 *   | 'personnel' | 'financial' | 'subsidy-given' | 'sales' | 'subsidy-received' | 'household'} JournalTone
 * @typedef {{ account: string, label: string, tone: JournalTone, household?: boolean, detail?: string, counter?: string }} PcgJournalEntry
 *
 * Every line of the journal moves money, so it is one leg on the bank (512) and one on `account`. A line whose own account IS the bank (a deposit, a
 * withdrawal) says the other leg in `counter`.
 */

/**
 * `detail` says what the line is in the game, in the player's words, where the account's own title does not (it is what the compte de
 * résultat prints in small grey under a line, so the player sees what a "charge externe" really is).
 * @param {string} account @param {string} label @param {JournalTone} tone @param {boolean} [household] @param {string} [detail]
 * @returns {PcgJournalEntry}
 */
const entry = (account, label, tone, household = false, detail = undefined, counter = undefined) =>
  Object.freeze({ account, label, tone, ...(household ? { household } : {}), ...(detail ? { detail } : {}), ...(counter ? { counter } : {}) });

/** The lines whose type is exactly this. */
const BY_TYPE = Object.freeze({
  // Classe 1 — capitaux et emprunts
  capital_funds: entry('101', 'Capital', 'capital'),
  // The founding capital the city pays a company or the business of a house: the city's holding in it (261), the company's capital (101). Never repaid.
  company_capital_paid: entry('261', 'Titres de participation', 'capital', false, 'Fonds propres versés à une entreprise'),
  company_capital_received: entry('101', 'Capital', 'capital', false, 'Fonds propres reçus de la ville'),
  loan_capital: entry('164', 'Emprunts auprès des établissements de crédit', 'loan'),
  loan_repayment: entry('164', 'Emprunts auprès des établissements de crédit', 'loan-repayment'),
  // Classe 2 — immobilisations
  construction: entry('213', 'Constructions', 'fixed-asset'),
  construction_refund: entry('213', 'Constructions', 'fixed-asset'),
  loan_capital_lent: entry('274', 'Prêts', 'loan'),
  loan_repayment_received: entry('274', 'Prêts', 'loan-repayment'),
  // Classe 4 — l'État
  citizen_tax: entry('447', 'Autres impôts, taxes et versements assimilés', 'tax-received'),
  payroll_tax: entry('4421', 'Prélèvements à la source (impôt sur le revenu)', 'tax-received'),
  vat: entry('4457', 'Taxes sur le chiffre d’affaires collectées', 'tax-received'),
  corporate_tax_revenue: entry('444', 'État - Impôts sur les bénéfices', 'tax-received'),
  income_tax: entry('4421', 'Prélèvements à la source (impôt sur le revenu)', 'tax-paid'),
  // An advance that turned out too high is given back at the year's close: the household receives it, the city pays it (the same account 4421).
  income_tax_refund: entry('4421', 'Prélèvements à la source (impôt sur le revenu) — remboursement', 'tax-received'),
  payroll_tax_refund: entry('4421', 'Prélèvements à la source (impôt sur le revenu) — remboursement', 'tax-paid'),
  citizen_tax_paid: entry('447', 'Autres impôts, taxes et versements assimilés', 'tax-paid'),
  corporate_tax: entry('695', 'Impôts sur les bénéfices', 'tax-paid'),
  social_contribution: entry('431', 'Sécurité sociale — cotisations perçues', 'tax-received'),
  employee_contribution: entry('431', 'Sécurité sociale — cotisations salariales', 'tax-paid', true),
  // Classe 4 — ce que les ménages perçoivent (hors PCG: un ménage n'est pas une entité)
  household_wage: entry('421', 'Personnel - Rémunérations dues', 'household', true),
  public_wage: entry('421', 'Personnel - Rémunérations dues', 'household', true),
  household_benefit: entry('437', 'Autres organismes sociaux', 'household', true),
  // Le loyer d'une maison à la maison du maire (le propriétaire) : une charge de logement du ménage, un produit locatif de la maison du maire.
  rent_paid: entry('6132', 'Locations immobilières', 'purchase', true, 'Loyer versé au propriétaire'),
  rent_received: entry('752', 'Revenus des immeubles', 'sales', false, 'Loyers des maisons'),
  // What a business pays the owner for the premises it works in (a cooperative's share of its house, a company's building): a charge of the
  // business, a rental income of the owner, apart from a household's rent.
  premises_rent_paid: entry('6132', 'Locations immobilières', 'purchase', false, 'Loyer du local d’activité'),
  premises_rent_received: entry('752', 'Revenus des immeubles', 'sales', false, 'Loyers des locaux d’activité'),
  // The debts a company paid off once it had the money (see PayableCatalog): the line of money against the debt account, the charge having been
  // booked when it fell due (an opération diverse). A debt of wages is received by the house of the workers like any wage.
  wage_debt_paid: entry('421', 'Personnel - Rémunérations dues', 'personnel', false, 'Salaires impayés réglés'),
  contribution_debt_paid: entry('431', 'Sécurité sociale — cotisations dues', 'personnel', false, 'Cotisations impayées réglées'),
  corporate_tax_debt_paid: entry('444', 'État - Impôts sur les bénéfices', 'tax-paid', false, 'Impôt impayé réglé'),
  premises_rent_debt_paid: entry('401', 'Fournisseurs — loyers dus', 'purchase', false, 'Loyer du local impayé réglé'),
  premises_rent_debt_received: entry('411', 'Clients — loyers dus', 'sales', false, 'Loyer du local impayé encaissé'),
  // Classe 5 — financiers
  // A deposit moves money from a house's account to the bank's, and the bank owes it back: 275 for the depositor, 165 for the bank.
  deposit: entry('512', 'Banques', 'treasury', false, undefined, '275'),
  withdrawal: entry('512', 'Banques', 'treasury', false, undefined, '275'),
  deposit_received: entry('512', 'Banques', 'treasury', false, undefined, '165'),
  withdrawal_paid: entry('512', 'Banques', 'treasury', false, undefined, '165'),
  household_deposit_interest: entry('512', 'Banques', 'treasury', true, undefined, '768'),
  // Classe 6 — charges
  producer_purchase: entry('607', 'Achats de marchandises', 'purchase', false, 'Biens achetés à un entrepôt'),
  consumer_purchase: entry('607', 'Achats de marchandises', 'purchase', true),
  service_purchase: entry('604', 'Achats d’études et prestations de services', 'purchase', false, 'Services payés (eau, énergie, soins…)'),
  maintenance: entry('6156', 'Maintenance', 'external', false, 'Entretien mensuel du bâtiment'),
  exceptional_expenses: entry('615', 'Entretien et réparation', 'external', false, 'Réparations exceptionnelles'),
  commercial_route: entry('6222', 'Commissions et courtages sur ventes', 'external', false, 'Frais d’ouverture d’une route commerciale'),
  contribution: entry('6281', 'Concours divers (cotisations)', 'external', false, 'Contribution pour révéler une dépêche'),
  salary: entry('6411', 'Salaires, appointements', 'personnel'),
  producer_wage: entry('6411', 'Salaires, appointements', 'personnel', false, 'Salaires des ouvriers du bâtiment'),
  employer_contribution: entry('645', 'Charges de sécurité sociale et de prévoyance', 'personnel', false, 'Cotisations patronales'),
  enterprise_participation: entry('691', 'Participation des salariés aux résultats', 'personnel', false, 'Part des résidents dans le résultat de l’entreprise'),
  // What the associates are paid is a share of the result paid out after the tax, not a charge: class 4, outside the compte de résultat.
  enterprise_dividend: entry('457', 'Associés — dividendes à payer', 'financial', false, 'Part des associés dans le résultat'),
  household_participation: entry('421', 'Personnel — participation aux résultats', 'household', true),
  household_dividend: entry('457', 'Associés — dividendes reçus', 'household', true),
  unemployment_benefit: entry('648', 'Autres charges de personnel', 'personnel', false, 'Allocation chômage'),
  loan_interest: entry('6611', 'Intérêts des emprunts et dettes', 'financial'),
  deposit_interest_paid: entry('6615', 'Intérêts des comptes courants et des dépôts créditeurs', 'financial'),
  subsidy_housing: entry('658', 'Charges diverses de gestion courante', 'subsidy-given', false, 'Aide au logement'),
  subsidy_companies: entry('658', 'Charges diverses de gestion courante', 'subsidy-given', false, 'Aide aux entreprises'),
  service_subsidy: entry('658', 'Charges diverses de gestion courante', 'subsidy-given', false, 'Aide aux services publics'),
  // Classe 7 — produits
  producer_revenue: entry('707', 'Ventes de marchandises', 'sales', false, 'Ventes du bâtiment'),
  service_sales: entry('706', 'Prestations de services', 'sales'),
  subsidy_companies_received: entry('741', 'Subventions d’exploitation', 'subsidy-received', false, 'Aide à l’entretien reçue de la ville'),
  // The share of the upkeep of the houses the hamlet pays their owner (the property company that bears it).
  subsidy_housing_received: entry('741', 'Subventions d’exploitation', 'subsidy-received', false, 'Aide du hameau à l’entretien des maisons'),
  service_subsidy_received: entry('741', 'Subventions d’exploitation', 'subsidy-received', false, 'Aide aux services publics reçue'),
  loan_interest_received: entry('7626', 'Revenus des prêts', 'sales'),
});

/**
 * The lines whose type starts with this prefix (a trade line carries its good in its type: `import_coal`). The most specific prefix
 * is read first.
 */
const BY_PREFIX = Object.freeze([
  ['duty_paid_import_', entry('608', 'Frais accessoires incorporés aux achats (droits de douane)', 'tax-paid')],
  ['duty_paid_export_', entry('6353', 'Impôts indirects (droits de douane)', 'tax-paid')],
  ['customs_import_', entry('447', 'Autres impôts, taxes et versements assimilés (droits de douane)', 'tax-received')],
  ['abroad_sale_', entry('707', 'Ventes de marchandises (à l’étranger)', 'sales')],
  ['freight_', entry('6241', 'Transports sur achats', 'external')],
  ['import_', entry('607', 'Achats de marchandises (à l’étranger)', 'purchase')],
  ['export_', entry('447', 'Autres impôts, taxes et versements assimilés (droits de douane)', 'tax-received')],
]);

/**
 * The opérations diverses (OD): lines that move no money and are written once a month by the closing of the accounts (see CloseMonthAccounts). Each says
 * its two legs: the account debited and the account credited, one of them a charge or a product (the result) and the other a balance-sheet account.
 *   - the variation of stock: a stock that grows is debited to the stock account (37 goods bought and resold, 35 goods made) and credited to the
 *     variation (6037, 713); a stock that shrinks is the other way round. It is what turns purchases into the cost of the goods sold;
 *   - the depreciation: the monthly dotation (6811) against the accumulated depreciation of the constructions (281).
 * @type {Readonly<Record<string, { debit: string, credit: string, label: string, tone: JournalTone, detail: string }>>}
 */
const OPERATIONS_DIVERSES = Object.freeze({
  od_stock_up_merchandise: Object.freeze({ debit: '37', credit: '6037', label: 'Variation des stocks de marchandises', tone: 'purchase', detail: 'Le stock a grandi : une partie des achats n’est pas encore consommée' }),
  od_stock_down_merchandise: Object.freeze({ debit: '6037', credit: '37', label: 'Variation des stocks de marchandises', tone: 'purchase', detail: 'Le stock a baissé : des achats d’avant sont consommés' }),
  od_stock_up_production: Object.freeze({ debit: '35', credit: '713', label: 'Production stockée', tone: 'sales', detail: 'Le stock de ce qui est fabriqué a grandi' }),
  od_stock_down_production: Object.freeze({ debit: '713', credit: '35', label: 'Production stockée', tone: 'sales', detail: 'Le stock de ce qui est fabriqué a baissé' }),
  od_depreciation: Object.freeze({ debit: '6811', credit: '281', label: 'Dotations aux amortissements des immobilisations', tone: 'external', detail: 'Les constructions perdent de leur valeur avec le temps' }),
  // A charge a company cannot pay when it falls due is booked all the same (the charge of the month) against what it owes (see PayableCatalog); the owner's
  // rent that is not paid is an income of the owner all the same, against what it is owed (a receivable, 411).
  od_payable_wage: Object.freeze({ debit: '6411', credit: '421', label: 'Salaires', tone: 'personnel', detail: 'Salaires dus, pas encore payés' }),
  od_payable_contribution: Object.freeze({ debit: '645', credit: '431', label: 'Cotisations sociales', tone: 'personnel', detail: 'Cotisations dues, pas encore payées' }),
  od_payable_corporate_tax: Object.freeze({ debit: '695', credit: '444', label: 'Impôts sur les bénéfices', tone: 'tax-paid', detail: 'Impôt dû, pas encore payé' }),
  od_payable_premises_rent: Object.freeze({ debit: '6132', credit: '401', label: 'Locations immobilières', tone: 'purchase', detail: 'Loyer du local dû, pas encore payé' }),
  od_receivable_premises_rent: Object.freeze({ debit: '411', credit: '752', label: 'Revenus des immeubles', tone: 'sales', detail: 'Loyer du local dû à la SCI, pas encore encaissé' }),
  // The owner holds the buildings the city paid for: they enter its books as fixed assets (213) against the city's contribution in kind (capital, 101).
  od_asset_contribution: Object.freeze({ debit: '213', credit: '101', label: 'Constructions apportées par la ville', tone: 'fixed-asset', detail: 'Un bâtiment payé par la ville entre dans le patrimoine de la SCI' }),
  // A building that is gone leaves the owner's books: its depreciation so far is released, and what it was still worth is a loss (675).
  od_asset_disposal_amortization: Object.freeze({ debit: '281', credit: '213', label: 'Amortissements des constructions démolies', tone: 'fixed-asset', detail: 'Un bâtiment démoli sort du patrimoine : son amortissement est soldé' }),
  od_asset_disposal_loss: Object.freeze({ debit: '675', credit: '213', label: 'Valeur nette des constructions démolies', tone: 'external', detail: 'Ce que le bâtiment démoli valait encore dans les livres' }),
});

/** @param {string} type @returns {boolean} true for an opération diverse: a line that moves no money. */
export function isOperationDiverse(type) {
  return typeof type === 'string' && Object.hasOwn(OPERATIONS_DIVERSES, type);
}

/**
 * @param {string} type An opération diverse's type.
 * @returns {{ debit: string, credit: string, label: string, tone: JournalTone, detail: string }}
 */
export function odLegsOf(type) {
  if (!isOperationDiverse(type)) throw new Error(`[PcgJournalCatalog] "${type}" is not an opération diverse`);
  return OPERATIONS_DIVERSES[type];
}

const isResultAccount = (account) => account[0] === '6' || account[0] === '7';

/** The leg of an opération diverse that is a charge or a product, the one the compte de résultat reads; null when both legs are balance-sheet accounts. */
function resultLegOf(od) {
  if (isResultAccount(od.debit)) return { account: od.debit, side: 'debit' };
  if (isResultAccount(od.credit)) return { account: od.credit, side: 'credit' };
  return null;
}

/**
 * What an opération diverse adds to the line of the compte de résultat its account feeds: a charge counts as positive when debited, a product when
 * credited, and the other way round takes off (a stock that grows lowers the cost of the purchases).
 * @param {string} type @param {number} amount
 * @returns {number} the signed amount
 */
export function statementAmountOfOd(type, amount) {
  const leg = resultLegOf(odLegsOf(type));
  if (!leg) throw new Error(`[PcgJournalCatalog] "${type}" touches no charge or product: it has no place in the compte de résultat`);
  const { account, side } = leg;
  const isCharge = account[0] === '6';
  return (isCharge ? side === 'debit' : side === 'credit') ? amount : -amount;
}

/**
 * @param {string} type A journal line's type.
 * @returns {PcgJournalEntry | null} Where the line sits in the chart of accounts, or null for a type with none (an informative line, a
 *   closing): the journal says so, it never invents an account.
 */
export function pcgOfJournalType(type) {
  if (BY_TYPE[type]) return BY_TYPE[type];
  // An opération diverse is read in the result through its charge or product leg.
  if (isOperationDiverse(type)) {
    const od = OPERATIONS_DIVERSES[type];
    const leg = resultLegOf(od);
    return leg ? entry(leg.account, od.label, od.tone, false, od.detail) : null;
  }
  return BY_PREFIX.find(([prefix]) => type.startsWith(prefix))?.[1] ?? null;
}

/** The accounts no line is "about" (the bank, a counter-account, the carried result of a purged year). */
const EXTRA_ACCOUNT_LABELS = Object.freeze({
  '512': 'Banques',
  '12': 'Résultat reporté (années clôturées)',
  '275': 'Dépôts et cautionnements versés',
  '165': 'Dépôts et cautionnements reçus',
  '768': 'Autres produits financiers',
  '35': 'Stocks de produits',
  '37': 'Stocks de marchandises',
  '281': 'Amortissements des immobilisations corporelles',
  '6037': 'Variation des stocks de marchandises',
  '713': 'Variation des stocks de produits',
  '6811': 'Dotations aux amortissements des immobilisations',
  '675': 'Valeurs comptables des éléments d’actif cédés',
  '431': 'Sécurité sociale',
  '6411': 'Salaires, appointements',
  '645': 'Charges de sécurité sociale et de prévoyance',
  '695': 'Impôts sur les bénéfices',
  '6132': 'Locations immobilières',
  '752': 'Revenus des immeubles',
});

/**
 * @param {string} account A PCG account number the journal posts to.
 * @returns {string} Its title in the plan comptable, as the catalog gives it (the first line type that posts to it names it); throws for an account it does not know.
 */
export function accountLabelOf(account) {
  if (EXTRA_ACCOUNT_LABELS[account]) return EXTRA_ACCOUNT_LABELS[account];
  const named = Object.values(BY_TYPE).find((candidate) => candidate.account === account) ?? BY_PREFIX.map(([, candidate]) => candidate).find((candidate) => candidate.account === account);
  if (!named) throw new Error(`[PcgJournalCatalog] the account ${account} has no title: no line type posts to it`);
  return named.label.replace(/ \(.*\)$/, '');
}

/**
 * @param {string} type A journal line's type.
 * @returns {string | null} The good a trade line carries in its type (`import_coal` → `coal`), null for a type that carries none.
 */
export function goodOfJournalType(type) {
  const prefix = BY_PREFIX.find(([candidate]) => type.startsWith(candidate))?.[0];
  return prefix ? type.slice(prefix.length) : null;
}

/** The colour families, for the filter pills and a legend: each tone and the PCG class it stands for. */
export const JOURNAL_TONES = Object.freeze([
  'capital', 'loan', 'loan-repayment', 'fixed-asset', 'tax-received', 'tax-paid', 'treasury', 'purchase', 'external', 'personnel',
  'financial', 'subsidy-given', 'sales', 'subsidy-received', 'household',
]);

/**
 * The income statement of a company or of a house's business, in the model of the plan comptable (ANC 2014-03, art. 821-2 and 822-2,
 * "modèle de compte de résultat"): the operating income and charges, the financial and the exceptional results, the tax on profits.
 * Each line says the accounts that feed it (an account number, or the start of one: `61` is every 61x), so a line of the journal lands
 * in the statement through its account and nowhere else. The totals and the results are computed from the lines (BuildingFinancePolicy).
 *
 * `direction` says which side the section is on: an income section adds to the result, a charge section takes from it.
 * @typedef {{ id: string, label: string, accounts: ReadonlyArray<string>, tone: JournalTone }} StatementLine
 * @typedef {{ id: string, label: string, direction: 'income' | 'charge', lines: ReadonlyArray<StatementLine> }} StatementSection
 * @type {ReadonlyArray<StatementSection>}
 */
const RAW_INCOME_STATEMENT = Object.freeze([
  Object.freeze({
    id: 'operatingIncome', label: "Produits d'exploitation", direction: 'income',
    lines: Object.freeze([
      Object.freeze({ id: 'goodsSold', label: 'Ventes de marchandises', accounts: Object.freeze(['707']) }),
      Object.freeze({ id: 'productionSold', label: 'Production vendue (biens et services)', accounts: Object.freeze(['701', '702', '703', '704', '705', '706', '708']) }),
      Object.freeze({ id: 'storedProduction', label: 'Production stockée', accounts: Object.freeze(['713']) }),
      Object.freeze({ id: 'subsidies', label: "Subventions d'exploitation", accounts: Object.freeze(['74']) }),
      Object.freeze({ id: 'otherIncome', label: 'Autres produits', accounts: Object.freeze(['75', '78']) }),
    ]),
  }),
  Object.freeze({
    id: 'operatingCharges', label: "Charges d'exploitation", direction: 'charge',
    lines: Object.freeze([
      Object.freeze({ id: 'merchandisePurchases', label: 'Achats de marchandises', accounts: Object.freeze(['607', '608']) }),
      Object.freeze({ id: 'materialPurchases', label: 'Achats de matières premières et autres approvisionnements', accounts: Object.freeze(['601', '602']) }),
      Object.freeze({ id: 'stockVariation', label: 'Variation de stock de marchandises', accounts: Object.freeze(['603']) }),
      Object.freeze({ id: 'externalCharges', label: 'Autres achats et charges externes', accounts: Object.freeze(['604', '605', '606', '61', '62']) }),
      Object.freeze({ id: 'taxes', label: 'Impôts, taxes et versements assimilés', accounts: Object.freeze(['63']) }),
      Object.freeze({ id: 'wages', label: 'Salaires', accounts: Object.freeze(['641']) }),
      Object.freeze({ id: 'socialCharges', label: 'Cotisations sociales', accounts: Object.freeze(['645', '647']) }),
      Object.freeze({ id: 'depreciation', label: 'Dotations aux amortissements', accounts: Object.freeze(['681']) }),
      Object.freeze({ id: 'otherCharges', label: 'Autres charges', accounts: Object.freeze(['648', '65']) }),
    ]),
  }),
  Object.freeze({
    id: 'financialIncome', label: 'Produits financiers', direction: 'income',
    lines: Object.freeze([Object.freeze({ id: 'financialIncomeLine', label: 'Intérêts et produits assimilés', accounts: Object.freeze(['76']) })]),
  }),
  Object.freeze({
    id: 'financialCharges', label: 'Charges financières', direction: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'financialChargesLine', label: 'Intérêts et charges assimilées', accounts: Object.freeze(['66']) })]),
  }),
  Object.freeze({
    id: 'exceptionalIncome', label: 'Produits exceptionnels', direction: 'income',
    lines: Object.freeze([Object.freeze({ id: 'exceptionalIncomeLine', label: 'Produits exceptionnels', accounts: Object.freeze(['77']) })]),
  }),
  Object.freeze({
    id: 'exceptionalCharges', label: 'Charges exceptionnelles', direction: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'exceptionalChargesLine', label: 'Charges exceptionnelles', accounts: Object.freeze(['67']) })]),
  }),
  // A cooperative's workers share of the surplus: a charge before the tax on profits (the model of the plan comptable puts it just above it).
  Object.freeze({
    id: 'workersParticipation', label: 'Participation des salariés aux résultats', direction: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'workersParticipationLine', label: 'Participation des salariés aux résultats', accounts: Object.freeze(['691']) })]),
  }),
  Object.freeze({
    id: 'profitTax', label: 'Impôts sur les bénéfices', direction: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'profitTaxLine', label: 'Impôts sur les bénéfices', accounts: Object.freeze(['695', '698']) })]),
  }),
]);

/** The colour family of each line of the statement, the same families as the journal's lines (a tax is blue, a wage orange, a sale green…). */
const LINE_TONES = Object.freeze({
  goodsSold: 'sales', productionSold: 'sales', storedProduction: 'sales', subsidies: 'subsidy-received', otherIncome: 'sales',
  merchandisePurchases: 'purchase', materialPurchases: 'purchase', stockVariation: 'purchase', depreciation: 'external', externalCharges: 'external', taxes: 'tax-paid',
  wages: 'personnel', socialCharges: 'personnel', otherCharges: 'subsidy-given',
  financialIncomeLine: 'sales', financialChargesLine: 'financial', exceptionalIncomeLine: 'sales', exceptionalChargesLine: 'external',
  workersParticipationLine: 'personnel', profitTaxLine: 'tax-paid',
});

/** The statement with each line wearing its tone: a line with none throws, so a new line cannot slip in uncoloured. */
export const INCOME_STATEMENT = Object.freeze(
  RAW_INCOME_STATEMENT.map((section) =>
    Object.freeze({
      ...section,
      lines: Object.freeze(
        section.lines.map((line) => {
          if (!LINE_TONES[line.id]) throw new Error(`[PcgJournalCatalog] the statement line "${line.id}" has no tone`);
          return Object.freeze({ ...line, tone: LINE_TONES[line.id] });
        }),
      ),
    }),
  ),
);

/**
 * The charges that follow the quantity sold (what the goods cost, their freight, the customs duty on them): every other operating or
 * financial charge is fixed in the break-even analysis. An account is named by the start of its number, like the statement's lines.
 * Exceptional charges and the tax on profits are in neither class: they are not part of the usual cost structure.
 */
const VARIABLE_CHARGE_ACCOUNTS = Object.freeze(['601', '602', '603', '607', '608', '6241', '6353']);

/** @param {string} account @returns {boolean} true for a charge that varies with the volume sold (see VARIABLE_CHARGE_ACCOUNTS). */
export function isVariableChargeAccount(account) {
  return VARIABLE_CHARGE_ACCOUNTS.some((prefix) => account.startsWith(prefix));
}

/**
 * The line of the income statement that an account feeds: the one naming the longest start of it.
 * @param {string} account
 * @returns {{ section: StatementSection, line: StatementLine } | null} null for an account that is not part of a result (capital, loans,
 *   fixed assets, the State's dues, the bank: they move the balance sheet, not the result)
 */
export function statementLineOfAccount(account) {
  let best = null;
  for (const section of INCOME_STATEMENT) {
    for (const line of section.lines) {
      for (const prefix of line.accounts) {
        if (account.startsWith(prefix) && (best === null || prefix.length > best.prefix.length)) best = { prefix, section, line };
      }
    }
  }
  return best && { section: best.section, line: best.line };
}
