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
 * @typedef {{ account: string, label: string, tone: JournalTone, household?: boolean, detail?: string }} PcgJournalEntry
 */

/**
 * `detail` says what the line is in the game, in the player's words, where the account's own title does not (it is what the compte de
 * résultat prints in small grey under a line, so the player sees what a "charge externe" really is).
 * @param {string} account @param {string} label @param {JournalTone} tone @param {boolean} [household] @param {string} [detail]
 * @returns {PcgJournalEntry}
 */
const entry = (account, label, tone, household = false, detail = undefined) =>
  Object.freeze({ account, label, tone, ...(household ? { household } : {}), ...(detail ? { detail } : {}) });

/** The lines whose type is exactly this. */
const BY_TYPE = Object.freeze({
  // Classe 1 — capitaux et emprunts
  capital_funds: entry('101', 'Capital', 'capital'),
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
  citizen_tax_paid: entry('447', 'Autres impôts, taxes et versements assimilés', 'tax-paid'),
  corporate_tax: entry('695', 'Impôts sur les bénéfices', 'tax-paid'),
  // Classe 4 — ce que les ménages perçoivent (hors PCG: un ménage n'est pas une entité)
  household_wage: entry('421', 'Personnel - Rémunérations dues', 'household', true),
  public_wage: entry('421', 'Personnel - Rémunérations dues', 'household', true),
  household_benefit: entry('437', 'Autres organismes sociaux', 'household', true),
  // Classe 5 — financiers
  deposit: entry('512', 'Banques', 'treasury'),
  withdrawal: entry('512', 'Banques', 'treasury'),
  deposit_received: entry('512', 'Banques', 'treasury'),
  withdrawal_paid: entry('512', 'Banques', 'treasury'),
  household_deposit_interest: entry('512', 'Banques', 'treasury', true),
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
 * @param {string} type A journal line's type.
 * @returns {PcgJournalEntry | null} Where the line sits in the chart of accounts, or null for a type with none (an informative line, a
 *   closing): the journal says so, it never invents an account.
 */
export function pcgOfJournalType(type) {
  if (BY_TYPE[type]) return BY_TYPE[type];
  return BY_PREFIX.find(([prefix]) => type.startsWith(prefix))?.[1] ?? null;
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
      Object.freeze({ id: 'subsidies', label: "Subventions d'exploitation", accounts: Object.freeze(['74']) }),
      Object.freeze({ id: 'otherIncome', label: 'Autres produits', accounts: Object.freeze(['75', '78']) }),
    ]),
  }),
  Object.freeze({
    id: 'operatingCharges', label: "Charges d'exploitation", direction: 'charge',
    lines: Object.freeze([
      Object.freeze({ id: 'merchandisePurchases', label: 'Achats de marchandises', accounts: Object.freeze(['607', '608']) }),
      Object.freeze({ id: 'materialPurchases', label: 'Achats de matières premières et autres approvisionnements', accounts: Object.freeze(['601', '602']) }),
      Object.freeze({ id: 'externalCharges', label: 'Autres achats et charges externes', accounts: Object.freeze(['604', '605', '606', '61', '62']) }),
      Object.freeze({ id: 'taxes', label: 'Impôts, taxes et versements assimilés', accounts: Object.freeze(['63']) }),
      Object.freeze({ id: 'wages', label: 'Salaires', accounts: Object.freeze(['641']) }),
      Object.freeze({ id: 'socialCharges', label: 'Cotisations sociales', accounts: Object.freeze(['645', '647']) }),
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
  Object.freeze({
    id: 'profitTax', label: 'Impôts sur les bénéfices', direction: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'profitTaxLine', label: 'Impôts sur les bénéfices', accounts: Object.freeze(['69']) })]),
  }),
]);

/** The colour family of each line of the statement, the same families as the journal's lines (a tax is blue, a wage orange, a sale green…). */
const LINE_TONES = Object.freeze({
  goodsSold: 'sales', productionSold: 'sales', subsidies: 'subsidy-received', otherIncome: 'sales',
  merchandisePurchases: 'purchase', materialPurchases: 'purchase', externalCharges: 'external', taxes: 'tax-paid',
  wages: 'personnel', socialCharges: 'personnel', otherCharges: 'subsidy-given',
  financialIncomeLine: 'sales', financialChargesLine: 'financial', exceptionalIncomeLine: 'sales', exceptionalChargesLine: 'external',
  profitTaxLine: 'tax-paid',
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
const VARIABLE_CHARGE_ACCOUNTS = Object.freeze(['601', '602', '607', '608', '6241', '6353']);

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
