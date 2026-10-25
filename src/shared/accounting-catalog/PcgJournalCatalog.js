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
 * @typedef {{ debit: string, credit: string }} EntryLegs the two accounts of an écriture: the one debited and the one credited, for the same amount
 * @typedef {{ legs: EntryLegs, account: string, label: string, detail?: string }} AccountingVariant one type of écriture as one chart of accounts books it
 * @typedef {AccountingVariant & { tone: JournalTone, household?: boolean, journal: string, plans: { pcg?: AccountingVariant, m57?: AccountingVariant } }} PcgJournalEntry
 *
 * Every type of écriture names both its legs, the bank (512) included: nothing is guessed afterwards. A type says them for each chart of accounts
 * that books it: `pcg` (companies, the property company, the cooperatives, the households' mirror) and `m57` (the city and the hamlets, which follow
 * the M57 chart of accounts, itself built on the PCG: their taxes are products of class 7, not debts to the taxpayer). The top-level `legs`,
 * `account`, `label` and `detail` are those of the first chart that books the type (the PCG's when it has one): what the statements read.
 * `account` is the leg that is not the bank. `journal` is the journal code (`BQ` bank, `OD` opérations diverses; the other codes come with the
 * entries booked when due).
 */

const BANK = '512';

/** @param {string} account @returns {EntryLegs} money arriving: the bank is debited, `account` credited. */
const inflow = (account) => Object.freeze({ debit: BANK, credit: account });
/** @param {string} account @returns {EntryLegs} money leaving: `account` is debited, the bank credited. */
const outflow = (account) => Object.freeze({ debit: account, credit: BANK });

/** @param {EntryLegs} legs @returns {string} the leg that is not the bank */
function otherThanBank(legs) {
  if (legs.debit === BANK) return legs.credit;
  if (legs.credit === BANK) return legs.debit;
  throw new Error(`[PcgJournalCatalog] the legs ${legs.debit} / ${legs.credit} do not touch the bank: an opération diverse names its own legs`);
}

/** @returns {AccountingVariant} */
const variant = (legs, label, detail = undefined) =>
  Object.freeze({ legs, account: otherThanBank(legs), label, ...(detail ? { detail } : {}) });

/**
 * How the M57 chart books a type (the city and the hamlets). `detail` as in `entry`.
 * @param {EntryLegs} legs @param {string} label @param {string} [detail]
 */
const publicVariant = (legs, label, detail = undefined) => variant(legs, label, detail);

/**
 * `detail` says what the line is in the game, in the player's words, where the account's own title does not (it is what the compte de
 * résultat prints in small grey under a line, so the player sees what a "charge externe" really is). `m57` is the M57 variant, for a type the city
 * writes too. `journal` is the journal code, `BQ` (bank) unless the type says another (`PA`: the pay).
 * @param {EntryLegs} legs @param {string} label @param {JournalTone} tone @param {boolean} [household] @param {string} [detail] @param {AccountingVariant} [m57] @param {string} [journal]
 * @returns {PcgJournalEntry}
 */
const entry = (legs, label, tone, household = false, detail = undefined, m57 = undefined, journal = 'BQ') => {
  const pcg = variant(legs, label, detail);
  return Object.freeze({ ...pcg, tone, journal, plans: Object.freeze({ pcg, ...(m57 ? { m57 } : {}) }), ...(household ? { household } : {}) });
};

/**
 * A type only the city and the hamlets write (a tax received, a benefit paid): it has no PCG variant, so a company that wrote it would throw.
 * @param {EntryLegs} legs @param {string} label @param {JournalTone} tone @param {string} [detail]
 * @returns {PcgJournalEntry}
 */
const publicEntry = (legs, label, tone, detail = undefined) => {
  const m57 = publicVariant(legs, label, detail);
  return Object.freeze({ ...m57, tone, journal: 'BQ', plans: Object.freeze({ m57 }) });
};

/** The lines whose type is exactly this. */
const BY_TYPE = Object.freeze({
  // Classe 1 — capitaux et emprunts
  // The city's starting funds are its dotations (1021) in the M57 chart; a company's capital is 101.
  capital_funds: entry(inflow('101'), 'Capital', 'capital', false, undefined, publicVariant(inflow('1021'), 'Dotations')),
  // The founding capital the city pays a company or the business of a house: the city's holding in it (261), the company's capital (101). Never repaid.
  company_capital_paid: entry(outflow('261'), 'Titres de participation', 'capital', false, 'Fonds propres versés à une entreprise', publicVariant(outflow('261'), 'Titres de participation', 'Fonds propres versés à une entreprise')),
  company_capital_received: entry(inflow('101'), 'Capital', 'capital', false, 'Fonds propres reçus de la ville'),
  loan_capital: entry(inflow('164'), 'Emprunts auprès des établissements de crédit', 'loan', false, undefined, publicVariant(inflow('1641'), 'Emprunts en euros')),
  loan_repayment: entry(outflow('164'), 'Emprunts auprès des établissements de crédit', 'loan-repayment', false, undefined, publicVariant(outflow('1641'), 'Emprunts en euros')),
  // Classe 2 — immobilisations
  construction: entry(outflow('213'), 'Constructions', 'fixed-asset', false, undefined, publicVariant(outflow('2131'), 'Bâtiments publics')),
  construction_refund: entry(inflow('213'), 'Constructions', 'fixed-asset', false, undefined, publicVariant(inflow('2131'), 'Bâtiments publics')),
  loan_capital_lent: entry(outflow('274'), 'Prêts', 'loan'),
  loan_repayment_received: entry(inflow('274'), 'Prêts', 'loan-repayment'),
  // Classe 4 — l'État. What the city receives is a product of class 7 in the M57 chart (73), not a debt to the taxpayer.
  citizen_tax: publicEntry(inflow('73111'), 'Impôts directs locaux', 'tax-received'),
  payroll_tax: publicEntry(inflow('738'), 'Autres impôts et taxes', 'tax-received', 'Prélèvement à la source sur les salaires'),
  vat: publicEntry(inflow('735'), 'Fraction de TVA', 'tax-received'),
  corporate_tax_revenue: publicEntry(inflow('73118'), 'Autres contributions directes', 'tax-received', 'Impôt sur les bénéfices des entreprises'),
  income_tax: entry(outflow('4421'), 'Prélèvements à la source (impôt sur le revenu)', 'tax-paid'),
  // An advance that turned out too high is given back at the year's close: the household receives it, the city pays it (7398, a restitution of tax).
  income_tax_refund: entry(inflow('4421'), 'Prélèvements à la source (impôt sur le revenu) — remboursement', 'tax-received'),
  payroll_tax_refund: publicEntry(outflow('7398'), 'Reversements, restitutions et prélèvements divers', 'tax-paid', 'Remboursement d’impôt sur le revenu'),
  citizen_tax_paid: entry(outflow('447'), 'Autres impôts, taxes et versements assimilés', 'tax-paid'),
  corporate_tax: entry(outflow('695'), 'Impôts sur les bénéfices', 'tax-paid'),
  // The contributions the city collects are owed to the social body: class 4 in its books (431), not a product. The benefit is paid out of the same account.
  social_contribution: publicEntry(inflow('431'), 'Sécurité sociale', 'tax-received', 'Cotisations perçues pour la sécurité sociale'),
  // Classe 4 — ce que les ménages perçoivent (hors PCG: un ménage n'est pas une entité). Une paie est une écriture du journal de paie (PA), le brut au crédit de ce que
  // le payeur doit : quand il retient la cotisation et l'impôt (431, 4421), elle a plus de deux jambes (voir WithholdingPolicy.payslipLegs) et l'argent qui arrive
  // sur le compte du ménage est le net.
  household_wage: entry(inflow('421'), 'Personnel - Rémunérations dues', 'household', true, undefined, undefined, 'PA'),
  public_wage: entry(inflow('421'), 'Personnel - Rémunérations dues', 'household', true, undefined, undefined, 'PA'),
  household_benefit: entry(inflow('437'), 'Autres organismes sociaux', 'household', true, undefined, undefined, 'PA'),
  // Le loyer d'une maison à la maison du maire (le propriétaire) : une charge de logement du ménage, un produit locatif de la maison du maire.
  rent_paid: entry(outflow('6132'), 'Locations immobilières', 'purchase', true, 'Loyer versé au propriétaire'),
  rent_received: entry(inflow('752'), 'Revenus des immeubles', 'sales', false, 'Loyers des maisons'),
  // What a business pays the owner for the premises it works in (a cooperative's share of its house, a company's building): a charge of the
  // business, a rental income of the owner, apart from a household's rent. A building with no operator is rented by the hamlet (613 in M57).
  premises_rent_paid: entry(outflow('6132'), 'Locations immobilières', 'purchase', false, 'Loyer du local d’activité', publicVariant(outflow('613'), 'Locations', 'Loyer du local d’activité')),
  premises_rent_received: entry(inflow('752'), 'Revenus des immeubles', 'sales', false, 'Loyers des locaux d’activité'),
  // The debts a company paid off once it had the money (see PayableCatalog): the line of money against the debt account, the charge having been
  // booked when it fell due (an opération diverse). A debt of wages is received by the house of the workers like any wage.
  wage_debt_paid: entry(outflow('421'), 'Personnel - Rémunérations dues', 'personnel', false, 'Salaires impayés réglés'),
  contribution_debt_paid: entry(outflow('431'), 'Sécurité sociale — cotisations dues', 'personnel', false, 'Cotisations impayées réglées'),
  corporate_tax_debt_paid: entry(outflow('444'), 'État - Impôts sur les bénéfices', 'tax-paid', false, 'Impôt impayé réglé'),
  premises_rent_debt_paid: entry(outflow('401'), 'Fournisseurs — loyers dus', 'purchase', false, 'Loyer du local impayé réglé'),
  premises_rent_debt_received: entry(inflow('411'), 'Clients — loyers dus', 'sales', false, 'Loyer du local impayé encaissé'),
  // What a company owed the city and pays at last: the city books it against the receivable it wrote when the debt fell due (see od_receivable_*), not as a product again.
  corporate_tax_debt_received: publicEntry(inflow('411'), 'Redevables', 'tax-received', 'Impôt sur les sociétés impayé encaissé'),
  contribution_debt_received: publicEntry(inflow('4387'), 'Organismes sociaux — produits à recevoir', 'tax-received', 'Cotisations impayées encaissées'),
  // Classe 5 — financiers
  // A deposit moves money from a house's account to the bank's, and the bank owes it back: 275 for the depositor, 165 for the bank.
  deposit: entry(outflow('275'), 'Dépôts et cautionnements versés', 'treasury'),
  withdrawal: entry(inflow('275'), 'Dépôts et cautionnements versés', 'treasury'),
  deposit_received: entry(inflow('165'), 'Dépôts et cautionnements reçus', 'treasury'),
  withdrawal_paid: entry(outflow('165'), 'Dépôts et cautionnements reçus', 'treasury'),
  household_deposit_interest: entry(inflow('768'), 'Autres produits financiers', 'treasury', true),
  // Classe 6 — charges
  producer_purchase: entry(outflow('607'), 'Achats de marchandises', 'purchase', false, 'Biens achetés à un entrepôt'),
  consumer_purchase: entry(outflow('607'), 'Achats de marchandises', 'purchase', true),
  service_purchase: entry(outflow('604'), 'Achats d’études et prestations de services', 'purchase', false, 'Services payés (eau, énergie, soins…)'),
  maintenance: entry(outflow('6156'), 'Maintenance', 'external', false, 'Entretien mensuel du bâtiment', publicVariant(outflow('6156'), 'Maintenance', 'Entretien mensuel du bâtiment')),
  exceptional_expenses: entry(outflow('615'), 'Entretien et réparation', 'external', false, 'Réparations exceptionnelles', publicVariant(outflow('615221'), 'Entretien et réparations des bâtiments publics', 'Réparations exceptionnelles')),
  commercial_route: entry(outflow('6222'), 'Commissions et courtages sur ventes', 'external', false, 'Frais d’ouverture d’une route commerciale', publicVariant(outflow('622'), 'Rémunérations d’intermédiaires et honoraires', 'Frais d’ouverture d’une route commerciale')),
  contribution: entry(outflow('6281'), 'Concours divers (cotisations)', 'external', false, 'Contribution pour révéler une dépêche', publicVariant(outflow('6281'), 'Concours divers (cotisations...)', 'Contribution pour révéler une dépêche')),
  salary: entry(outflow('6411'), 'Salaires, appointements', 'personnel', false, undefined, publicVariant(outflow('6411'), 'Personnel titulaire'), 'PA'),
  producer_wage: entry(outflow('6411'), 'Salaires, appointements', 'personnel', false, 'Salaires des ouvriers du bâtiment', undefined, 'PA'),
  employer_contribution: entry(outflow('645'), 'Charges de sécurité sociale et de prévoyance', 'personnel', false, 'Cotisations patronales'),
  enterprise_participation: entry(outflow('691'), 'Participation des salariés aux résultats', 'personnel', false, 'Part des résidents dans le résultat de l’entreprise'),
  // What the associates are paid is a share of the result paid out after the tax, not a charge: class 4, outside the compte de résultat.
  enterprise_dividend: entry(outflow('457'), 'Associés — dividendes à payer', 'financial', false, 'Part des associés dans le résultat'),
  household_participation: entry(inflow('421'), 'Personnel — participation aux résultats', 'household', true),
  household_dividend: entry(inflow('457'), 'Associés — dividendes reçus', 'household', true),
  // The benefit is paid out of what the city holds for the social body (431): it does not touch the city's result.
  unemployment_benefit: publicEntry(outflow('431'), 'Sécurité sociale', 'personnel', 'Allocation chômage'),
  loan_interest: entry(outflow('6611'), 'Intérêts des emprunts et dettes', 'financial', false, undefined, publicVariant(outflow('66111'), 'Intérêts réglés à l’échéance')),
  deposit_interest_paid: entry(outflow('6615'), 'Intérêts des comptes courants et des dépôts créditeurs', 'financial'),
  subsidy_housing: publicEntry(outflow('65741'), 'Subventions de fonctionnement aux ménages', 'subsidy-given', 'Aide au logement'),
  subsidy_companies: publicEntry(outflow('65742'), 'Subventions de fonctionnement aux entreprises', 'subsidy-given', 'Aide aux entreprises'),
  service_subsidy: publicEntry(outflow('65738'), 'Subventions de fonctionnement aux autres établissements publics', 'subsidy-given', 'Aide aux services publics'),
  // Classe 7 — produits
  producer_revenue: entry(inflow('707'), 'Ventes de marchandises', 'sales', false, 'Ventes du bâtiment'),
  service_sales: entry(inflow('706'), 'Prestations de services', 'sales'),
  subsidy_companies_received: entry(inflow('741'), 'Subventions d’exploitation', 'subsidy-received', false, 'Aide à l’entretien reçue de la ville'),
  // The share of the upkeep of the houses the hamlet pays their owner (the property company that bears it).
  subsidy_housing_received: entry(inflow('741'), 'Subventions d’exploitation', 'subsidy-received', false, 'Aide du hameau à l’entretien des maisons'),
  service_subsidy_received: entry(inflow('741'), 'Subventions d’exploitation', 'subsidy-received', false, 'Aide aux services publics reçue'),
  loan_interest_received: entry(inflow('7626'), 'Revenus des prêts', 'sales'),
});

/** @type {ReadonlyArray<string>} Every type of money line the catalog names exactly (a trade line is named by its prefix, below). */
export const JOURNAL_TYPES = Object.freeze(Object.keys(BY_TYPE));

/**
 * The lines whose type starts with this prefix (a trade line carries its good in its type: `import_coal`). The most specific prefix
 * is read first.
 */
const BY_PREFIX = Object.freeze([
  ['duty_paid_import_', entry(outflow('608'), 'Frais accessoires incorporés aux achats (droits de douane)', 'tax-paid')],
  ['duty_paid_export_', entry(outflow('6353'), 'Impôts indirects (droits de douane)', 'tax-paid')],
  ['customs_import_', publicEntry(inflow('73431'), 'Octroi de mer (droits de douane à l’entrée)', 'tax-received')],
  ['abroad_sale_', entry(inflow('707'), 'Ventes de marchandises (à l’étranger)', 'sales')],
  ['freight_', entry(outflow('6241'), 'Transports sur achats', 'external')],
  ['import_', entry(outflow('607'), 'Achats de marchandises (à l’étranger)', 'purchase', false, undefined, publicVariant(outflow('607'), 'Achats de marchandises (à l’étranger)'))],
  ['export_', publicEntry(inflow('7348'), 'Autres impôts et taxes d’Outre-mer (droits de douane à l’export)', 'tax-received')],
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
  // A debt owed to a building the player demolished: no one is left to be paid, so the debtor is released (an abandonment of the claim, an exceptional product, 7718)
  // and the debt closes (see PayableCatalog `abandonment`). A household is no entity of the plan: nothing is booked on its side, and it is not prosecuted.
  od_abandoned_wage: Object.freeze({ debit: '421', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Les salaires dus à une maison démolie ne seront jamais payés : la dette est abandonnée' }),
  od_receivable_premises_rent: Object.freeze({ debit: '411', credit: '752', label: 'Revenus des immeubles', tone: 'sales', detail: 'Loyer du local dû à la SCI, pas encore encaissé' }),
  // The city's side of what a company owes it (M57 chart): the tax is a product of the year it falls due, against a receivable (411, redevables); the contributions are
  // owed to the social body, so the city holds a receivable on the company (4387) against what it owes that body (431), no product.
  od_receivable_corporate_tax: Object.freeze({ debit: '411', credit: '73118', label: 'Autres contributions directes', tone: 'tax-received', detail: 'Impôt sur les bénéfices dû à la ville, pas encore encaissé' }),
  od_receivable_contribution: Object.freeze({ debit: '4387', credit: '431', label: 'Sécurité sociale', tone: 'tax-received', detail: 'Cotisations dues à la sécurité sociale, pas encore encaissées' }),
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
    if (!leg) return null;
    const legs = Object.freeze({ debit: od.debit, credit: od.credit });
    const own = Object.freeze({ legs, account: leg.account, label: od.label, detail: od.detail });
    return Object.freeze({ ...own, tone: od.tone, journal: 'OD', plans: Object.freeze({ pcg: own }) });
  }
  return BY_PREFIX.find(([prefix]) => type.startsWith(prefix))?.[1] ?? null;
}

/** The charts of accounts an écriture can be booked in: the PCG (companies, the property company, the cooperatives, the households' mirror) and the M57 (the city and the hamlets). */
export const ACCOUNTING_PLANS = Object.freeze(['pcg', 'm57']);

/**
 * @param {string | null | undefined} accountBuildingId The account an écriture belongs to (null: the city's own).
 * @returns {'pcg' | 'm57'} The chart of accounts that account follows.
 */
export function planOfAccount(accountBuildingId) {
  return accountBuildingId ? 'pcg' : 'm57';
}

/**
 * The two legs of one type of écriture in one chart of accounts: the account debited and the account credited, bank included.
 * @param {string} type A journal line's type.
 * @param {'pcg' | 'm57'} plan
 * @returns {EntryLegs} Throws when the type is unknown or that chart does not book it: a city writing a company's type is a defect, never a guessed account.
 */
export function legsOfType(type, plan) {
  if (!ACCOUNTING_PLANS.includes(plan)) throw new Error(`[PcgJournalCatalog] "${plan}" is not a chart of accounts (${ACCOUNTING_PLANS.join(', ')})`);
  const catalogued = pcgOfJournalType(type);
  if (!catalogued) throw new Error(`[PcgJournalCatalog] the type "${type}" has no legs in the chart of accounts`);
  const booked = catalogued.plans[plan];
  if (!booked) throw new Error(`[PcgJournalCatalog] the type "${type}" is not booked in the ${plan} chart of accounts`);
  return booked.legs;
}

/**
 * The types of écriture no other account books the other side of: the city's starting funds, what it builds and repairs, what a building bears of its own
 * upkeep (the repairer is not an actor of the game), what a merchant buys and sells abroad. Every other type is one side of a flow between accounts: its
 * écriture carries the `transactionId` of the flow, so the other side can be found.
 */
const NO_COUNTERPART_TYPES = Object.freeze(new Set(['capital_funds', 'construction', 'construction_refund', 'maintenance', 'exceptional_expenses', 'commercial_route', 'contribution']));
const NO_COUNTERPART_PREFIXES = Object.freeze(['import_', 'freight_', 'abroad_sale_']);
/** The opérations diverses that are one side of a flow: the rent a company owes its owner is the owner's receivable. */
const PAIRED_OPERATIONS = Object.freeze(new Set([
  'od_payable_premises_rent', 'od_receivable_premises_rent', 'od_payable_corporate_tax', 'od_receivable_corporate_tax', 'od_payable_contribution', 'od_receivable_contribution',
]));

/**
 * @param {string} type A journal line's type.
 * @returns {boolean} true when the type is one side of a flow between two accounts (the other side is booked by the other account, with the same `transactionId`).
 */
export function hasCounterpart(type) {
  if (isOperationDiverse(type)) return PAIRED_OPERATIONS.has(type);
  if (!pcgOfJournalType(type)) return false;
  return !NO_COUNTERPART_TYPES.has(type) && !NO_COUNTERPART_PREFIXES.some((prefix) => type.startsWith(prefix));
}

/** @param {string} type @returns {string} The journal code of a type of écriture. */
export function journalCodeOf(type) {
  // An opération diverse with no charge or product (a contribution in kind, a disposal's depreciation) has no place in the result, but it is an OD all the same.
  if (isOperationDiverse(type)) return 'OD';
  const catalogued = pcgOfJournalType(type);
  if (!catalogued) throw new Error(`[PcgJournalCatalog] the type "${type}" has no journal code: it is not in the chart of accounts`);
  return catalogued.journal;
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
  '7718': 'Autres produits exceptionnels sur opérations de gestion',
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
  const everyVariant = [...Object.values(BY_TYPE), ...BY_PREFIX.map(([, candidate]) => candidate)].flatMap((candidate) => Object.values(candidate.plans));
  const named = everyVariant.find((candidate) => candidate.account === account);
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
