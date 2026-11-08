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

import { STATE_ARREARS_KINDS, stateArrearsTypesOf } from './StateArrearsCatalog.js';

/** A company's or a household's money: its account at a bank (in the PCG, 512 "Banques"). */
const BANK = '512';
/**
 * A State's money (the city and the hamlets are States of a federation: docs/gameplay/PLAN_BANK_MONEY.md): its account at its central bank, the M57's 515 "compte
 * au Trésor", as the French Trésor's at the Banque de France.
 */
const TREASURY = '515';
/** The State's cash account, for the écritures of the State that name their own legs (a construction). */
export const TREASURY_ACCOUNT = TREASURY;

/**
 * The cash accounts: the money an account holds is their balance, and what moves them is what the cash flows tell (EntryLegsPolicy.cashFlowsOfLegs, the treasury,
 * the balance sheet, the city's ledger). 512, an account at a bank; 515, a State's account at its central bank; 53, banknotes (the caisse).
 */
export const CASH_ACCOUNTS = Object.freeze(new Set([BANK, TREASURY, '53']));

/** @param {string} account @returns {boolean} true for a cash account */
export function isCashAccount(account) {
  return CASH_ACCOUNTS.has(account);
}

/** @param {string} account @returns {EntryLegs} money arriving: the bank is debited, `account` credited. */
const inflow = (account) => Object.freeze({ debit: BANK, credit: account });
/** @param {string} account @returns {EntryLegs} money leaving: `account` is debited, the bank credited. */
const outflow = (account) => Object.freeze({ debit: account, credit: BANK });

/** @param {EntryLegs} legs @returns {string} the leg that is not the cash */
function otherThanBank(legs) {
  if (isCashAccount(legs.debit)) return legs.credit;
  if (isCashAccount(legs.credit)) return legs.debit;
  throw new Error(`[PcgJournalCatalog] the legs ${legs.debit} / ${legs.credit} do not touch the cash: an opération diverse names its own legs`);
}

/** @returns {AccountingVariant} */
const variant = (legs, label, detail = undefined) =>
  Object.freeze({ legs, account: otherThanBank(legs), label, ...(detail ? { detail } : {}) });

/** @param {EntryLegs} legs @returns {EntryLegs} the same legs, the State's money on its account at its central bank instead of a bank account */
const onTreasury = (legs) => Object.freeze({
  debit: legs.debit === BANK ? TREASURY : legs.debit,
  credit: legs.credit === BANK ? TREASURY : legs.credit,
});

/**
 * How the M57 chart books a type (the city and the hamlets): the State's money is on its account at its central bank (515), never at a bank. `detail` as in `entry`.
 * @param {EntryLegs} legs @param {string} label @param {string} [detail]
 */
const publicVariant = (legs, label, detail = undefined) => variant(onTreasury(legs), label, detail);

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

/**
 * The State's arrears (StateArrearsCatalog.js), one family of types per kind: what the State owes and pays later (a payment out of the Treasury against 401, M57 only).
 * @type {Record<string, PcgJournalEntry>}
 */
const STATE_ARREARS_PAYMENTS = Object.fromEntries(Object.entries(STATE_ARREARS_KINDS).map(([kind, facts]) => [
  stateArrearsTypesOf(kind).settlement,
  publicEntry(outflow('401'), 'Fournisseurs', 'personnel', `${facts.label} impayés réglés par l’État`),
]));

/** The lines whose type is exactly this. */
const BY_TYPE = Object.freeze({
  ...STATE_ARREARS_PAYMENTS,
  // Classe 1 — capitaux et emprunts
  // The city's starting funds are its dotations (1021) in the M57 chart; a company's capital is 101.
  capital_funds: entry(inflow('101'), 'Capital', 'capital', false, undefined, publicVariant(inflow('1021'), 'Dotations')),
  // The founding capital the city pays a company or the business of a house: the city's holding in it (261), the company's capital (101). Never repaid.
  company_capital_paid: entry(outflow('261'), 'Titres de participation', 'capital', false, 'Fonds propres versés à une entreprise', publicVariant(outflow('261'), 'Titres de participation', 'Fonds propres versés à une entreprise')),
  company_capital_received: entry(inflow('101'), 'Capital', 'capital', false, 'Fonds propres reçus de la ville'),
  // The aid the city gives a company for its working capital (see CompanyAidCatalog.js): capital as a shareholder (it gives the city a stake and dividends, the participation above gives none),
  // or a loan (274 for the city, 164 for the company) with its interest and its repayments, and the dividend the company pays its shareholder city.
  shareholder_capital_paid: entry(outflow('261'), 'Titres de participation', 'capital', false, 'Fonds propres versés en tant qu’actionnaire', publicVariant(outflow('261'), 'Titres de participation', 'Fonds propres versés en tant qu’actionnaire')),
  shareholder_capital_received: entry(inflow('101'), 'Capital', 'capital', false, 'Fonds propres reçus de la ville actionnaire'),
  aid_loan_paid: entry(outflow('274'), 'Prêts', 'loan', false, 'Fonds de roulement prêté à une entreprise', publicVariant(outflow('274'), 'Prêts', 'Fonds de roulement prêté à une entreprise')),
  aid_loan_received: entry(inflow('164'), 'Emprunts auprès des établissements de crédit', 'loan', false, 'Fonds de roulement prêté par la ville'),
  aid_loan_repaid: entry(outflow('164'), 'Emprunts auprès des établissements de crédit', 'loan-repayment', false, 'Prêt de la ville remboursé'),
  aid_loan_repayment_received: entry(inflow('274'), 'Prêts', 'loan-repayment', false, undefined, publicVariant(inflow('274'), 'Prêts', 'Prêt à une entreprise remboursé')),
  aid_interest_paid: entry(outflow('6611'), 'Intérêts des emprunts et dettes', 'financial', false, 'Intérêts d’un prêt de la ville'),
  aid_interest_received: entry(inflow('7626'), 'Revenus des prêts', 'sales', false, undefined, publicVariant(inflow('7626'), 'Revenus des prêts', 'Intérêts d’un prêt à une entreprise')),
  // The city sells shares it holds in a company to a private holder (the property company), at what they cost it: cash in against its holding (261); the buyer's cash out against its own.
  stake_sold: publicEntry(inflow('261'), 'Titres de participation', 'capital', 'Parts d’une entreprise cédées par la ville'),
  stake_bought: entry(outflow('261'), 'Titres de participation', 'capital', false, 'Parts d’une entreprise achetées à la ville'),
  // The dividend of a company to a private shareholder (the city's has its own types above).
  private_dividend_paid: entry(outflow('457'), 'Associés — dividendes à payer', 'financial', false, 'Dividendes versés à un actionnaire privé'),
  private_dividend_received: entry(inflow('761'), 'Produits des participations', 'sales', false, 'Dividendes reçus d’une entreprise dont on est actionnaire'),
  state_dividend_paid: entry(outflow('457'), 'Associés — dividendes à payer', 'financial', false, 'Dividendes versés à la ville actionnaire'),
  state_dividend_received: entry(inflow('761'), 'Produits des participations', 'sales', false, undefined, publicVariant(inflow('761'), 'Produits des participations', 'Dividendes d’une entreprise dont la ville est actionnaire')),
  // A company the player demolishes is liquidated (see LiquidateDemolishedBuilding.js): its stock is sold off, what its creditors left of its cash goes back to the city
  // as the return of the capital the city put in (the company's 101 out, the city's holding 261 back), and the wages it could not pay are advanced by the city.
  liquidation_stock_sale: entry(inflow('707'), 'Ventes de marchandises', 'sales', false, 'Stock vendu en liquidation'),
  liquidation_surplus_paid: entry(outflow('101'), 'Capital', 'capital', false, 'Caisse rendue à la ville à la liquidation'),
  liquidation_surplus_received: publicEntry(inflow('261'), 'Titres de participation', 'capital', 'Capital rendu par une entreprise liquidée'),
  wage_guarantee: publicEntry(outflow('65741'), 'Subventions de fonctionnement aux ménages', 'subsidy-given', 'Salaires impayés avancés par la ville (garantie des salaires)'),
  // The bank refinanced by the central bank (see BankRefinancing.js): it borrows the shortfall, pays the interest at the policy rate, and repays out of its surplus.
  // Booked on a sub-account of 164 (1649) so that what it owes the central bank is read apart from any other loan of the bank (a city aid loan, 164).
  // The central bank's side is an opération diverse (od_refinancing_*): it lends money it creates, so no cash leaves it.
  refinancing_received: entry(inflow('1649'), 'Emprunts — refinancement de la banque centrale', 'loan', false, 'Refinancement de la banque centrale'),
  refinancing_repaid: entry(outflow('1649'), 'Emprunts — refinancement de la banque centrale', 'loan-repayment', false, 'Refinancement remboursé à la banque centrale'),
  // The marginal lending: reserves the bank borrows at once to lend while it is short, at the dearer rate of the corridor; a sub-account of its own (1648) so its rate is kept apart.
  marginal_received: entry(inflow('1648'), 'Emprunts — prêt marginal de la banque centrale', 'loan', false, 'Prêt marginal de la banque centrale'),
  marginal_repaid: entry(outflow('1648'), 'Emprunts — prêt marginal de la banque centrale', 'loan-repayment', false, 'Prêt marginal remboursé à la banque centrale'),
  refinancing_interest_paid: entry(outflow('6611'), 'Intérêts des emprunts et dettes', 'financial', false, 'Intérêts du refinancement de la banque centrale'),
  // The bank's credit to a company short of cash for its month (BankCompanyCredit.js): the company borrows on a sub-account of 164 (1643) so that what it owes the
  // bank is read apart from a city aid loan (164); the bank lends it (274). Interest at the policy rate plus the business spread, repaid out of the month's profit.
  bank_credit_received: entry(inflow('1643'), 'Emprunts — crédit de la banque', 'loan', false, 'Crédit de la banque pour payer le mois'),
  bank_credit_lent: entry(outflow('274'), 'Prêts', 'loan', false, 'Crédit à une entreprise à court de trésorerie'),
  bank_credit_repaid: entry(outflow('1643'), 'Emprunts — crédit de la banque', 'loan-repayment', false, 'Crédit de la banque remboursé'),
  bank_credit_repayment_received: entry(inflow('274'), 'Prêts', 'loan-repayment', false, 'Crédit à une entreprise remboursé'),
  bank_credit_interest_paid: entry(outflow('6611'), 'Intérêts des emprunts et dettes', 'financial', false, 'Intérêts du crédit de la banque'),
  bank_credit_interest_received: entry(inflow('7626'), 'Revenus des prêts', 'sales', false, 'Intérêts du crédit à une entreprise'),
  // Every January a State's central bank pays its State what it earned (BankRefinancing.payProfitToCity). Its own side is an opération diverse (od_central_bank_profit_paid):
  // it holds no money, it credits the Treasury's account. The State receives it as a product (758 in the M57 chart: it holds no share of it, so it is no dividend).
  central_bank_profit_received: publicEntry(inflow('758'), 'Produits divers de gestion courante', 'sales', 'Résultat de la banque centrale reversé à l’État'),
  loan_capital: entry(inflow('164'), 'Emprunts auprès des établissements de crédit', 'loan', false, undefined, publicVariant(inflow('1641'), 'Emprunts en euros')),
  loan_repayment: entry(outflow('164'), 'Emprunts auprès des établissements de crédit', 'loan-repayment', false, undefined, publicVariant(outflow('1641'), 'Emprunts en euros')),
  // Classe 2 — immobilisations
  construction: entry(outflow('213'), 'Constructions', 'fixed-asset', false, undefined, publicVariant(outflow('2131'), 'Bâtiments publics')),
  // Land a company buys from the property company (SCI) of the owner's house: the buyer holds it as a fixed asset (211, land is not depreciated); the SCI found it for nothing,
  // so it books the whole price as the product of a disposal (775) with no book value to write off.
  land_purchase: entry(outflow('211'), 'Terrains', 'fixed-asset', false, 'Terrain acheté à la société immobilière'),
  land_sale: entry(inflow('775'), 'Produits des cessions d’éléments d’actif', 'sales', false, 'Terrain vendu à une entreprise'),
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
  household_sickness_benefit: entry(inflow('437'), 'Autres organismes sociaux', 'household', true, undefined, undefined, 'PA'),
  // An insurance company (see InsuranceCatalog.js) pays the household of its member who is sick: a charge of the company (658, the candidate of the general
  // chart, to confirm at the game's accounting audit), what the household receives against the mutual-insurance account (4372). The premium it was paid is
  // the household's `service_purchase` of the service `insurance` and the company's `service_sales`.
  insurance_benefit: entry(outflow('658'), 'Charges diverses de gestion courante', 'personnel', false, 'Indemnités versées aux adhérents malades'),
  household_insurance_benefit: entry(inflow('4372'), 'Mutuelles', 'household', true),
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
  // The interest on savings moves no cash: it is added to the savings (od_deposit_interest_credited / od_deposit_interest_owed, below).
  // A liquidated bank that cannot give its depositors their savings back: the city guarantees them (BankInsolvency): it pays the house (as the wage guarantee, a
  // subsidy to the households, 65741), and the house's claim on the bank (275) closes. The bank's debt to the house is abandoned (od_deposit_abandoned).
  deposit_guarantee: publicEntry(outflow('65741'), 'Subventions de fonctionnement aux ménages', 'subsidy-given', 'Épargne garantie par la ville (banque liquidée)'),
  // The premium the bank pays the city each month for the guarantee of its depositors' savings (a charge for the bank, 616; a product of the State, 758): the guarantee is funded by the banks.
  // A gift of another city (the benefactor, see BenefactorGiftCatalog.js): foreign money, a capital gift of the State (M57 1025, dons et legs en capital). The central bank converts it
  // against its foreign reserves with the rest of the money from abroad (BankRefinancing.centraliseExternal): it is not a founding endowment.
  benefactor_gift: publicEntry(inflow('1025'), 'Dons et legs en capital', 'capital', 'Don d’une ville partenaire'),
  deposit_guarantee_premium: entry(outflow('616'), 'Primes d’assurances', 'financial', false, 'Prime de la garantie des dépôts payée à la ville'),
  deposit_guarantee_premium_received: publicEntry(inflow('7588'), 'Autres produits divers de gestion courante', 'sales', 'Primes de la garantie des dépôts payées par la banque'),
  deposit_guarantee_received: entry(inflow('275'), 'Dépôts et cautionnements versés', 'treasury', true, 'Épargne rendue par la garantie de la ville'),
  // Classe 6 — charges
  producer_purchase: entry(outflow('607'), 'Achats de marchandises', 'purchase', false, 'Biens achetés à un fournisseur'),
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
  unemployment_benefit: publicEntry(outflow('4378'), 'Autres organismes sociaux', 'personnel', 'Allocation chômage'),
  // The sickness allowance is paid out of the health fund (431), the unemployment benefit out of the unemployment fund (4378): see SocialFundsCatalog.js.
  sickness_benefit: publicEntry(outflow('431'), 'Sécurité sociale', 'personnel', 'Indemnités journalières et pensions d’invalidité'),
  loan_interest: entry(outflow('6611'), 'Intérêts des emprunts et dettes', 'financial', false, undefined, publicVariant(outflow('66111'), 'Intérêts réglés à l’échéance')),
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
 *   - the depreciation: the monthly dotation (6811) against the accumulated depreciation of the constructions (281);
 *   - the interest on savings, written once a year by the settlement of the year's last month (SettleBankDepositInterest): added to the savings, not paid in cash.
 * `household`: a line of a household's account, outside the PCG (a household is no entity of the plan), as for the `entry` types above.
 * @type {Readonly<Record<string, { debit: string, credit: string, label: string, tone: JournalTone, detail: string, household?: boolean }>>}
 */
const OPERATIONS_DIVERSES = Object.freeze({
  // What the State could not pay when it fell due is booked all the same against what it owes (401); when the one it owes is gone, the debt is released (7718).
  ...Object.fromEntries(Object.entries(STATE_ARREARS_KINDS).flatMap(([kind, facts]) => [
    [stateArrearsTypesOf(kind).payable, Object.freeze({ debit: facts.expenseAccount, credit: '401', label: facts.label, tone: 'personnel', detail: `${facts.label} dus par l’État, pas encore payés` })],
    [stateArrearsTypesOf(kind).abandonment, Object.freeze({ debit: '401', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: `${facts.label} dus à un bâtiment disparu : la dette est abandonnée` })],
  ])),
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
  od_abandoned_wage: Object.freeze({ debit: '421', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Les salaires dus ne seront jamais payés : la dette est abandonnée' }),
  od_abandoned_contribution: Object.freeze({ debit: '431', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Les cotisations dues ne seront jamais payées : la dette est abandonnée' }),
  od_abandoned_corporate_tax: Object.freeze({ debit: '444', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'L’impôt dû ne sera jamais payé : la dette est abandonnée' }),
  od_abandoned_premises_rent: Object.freeze({ debit: '401', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Le loyer du local dû ne sera jamais payé : la dette est abandonnée' }),
  // The creditor's side of a debt that will never be paid: a loss on the claim it had booked when the debt fell due (the city's, against the receivable 4387 or 411;
  // the property company's, against 411).
  od_bad_debt_contribution: Object.freeze({ debit: '6541', credit: '4387', label: 'Créances admises en non-valeur', tone: 'external', detail: 'Des cotisations dues à la ville ne seront jamais encaissées' }),
  od_bad_debt_corporate_tax: Object.freeze({ debit: '6541', credit: '411', label: 'Créances admises en non-valeur', tone: 'external', detail: 'Un impôt dû à la ville ne sera jamais encaissé' }),
  od_bad_debt_premises_rent: Object.freeze({ debit: '654', credit: '411', label: 'Pertes sur créances irrécouvrables', tone: 'external', detail: 'Un loyer de local dû à la SCI ne sera jamais encaissé' }),
  // What a company that is liquidated still owes the city of a loan of working capital is abandoned (the debtor is released, 7718) and the city bears the loss (654).
  od_aid_loan_abandoned: Object.freeze({ debit: '164', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Le prêt de la ville ne sera jamais remboursé : la dette est abandonnée' }),
  od_aid_loan_loss: Object.freeze({ debit: '654', credit: '274', label: 'Pertes sur créances irrécouvrables', tone: 'external', detail: 'Un prêt de la ville à une entreprise liquidée ne sera jamais remboursé' }),
  // What the city held in a company that is liquidated and did not give back: its holding (261) leaves the books at a loss (675).
  od_holding_written_off: Object.freeze({ debit: '675', credit: '261', label: 'Valeurs comptables des éléments d’actif cédés', tone: 'external', detail: 'Le capital que la ville avait mis dans une entreprise liquidée est perdu' }),
  od_receivable_premises_rent: Object.freeze({ debit: '411', credit: '752', label: 'Revenus des immeubles', tone: 'sales', detail: 'Loyer du local dû à la SCI, pas encore encaissé' }),
  // The city's side of what a company owes it (M57 chart): the tax is a product of the year it falls due, against a receivable (411, redevables); the contributions are
  // owed to the social body, so the city holds a receivable on the company (4387) against what it owes that body (431), no product.
  od_receivable_corporate_tax: Object.freeze({ debit: '411', credit: '73118', label: 'Autres contributions directes', tone: 'tax-received', detail: 'Impôt sur les bénéfices dû à la ville, pas encore encaissé' }),
  od_receivable_contribution: Object.freeze({ debit: '4387', credit: '431', label: 'Sécurité sociale', tone: 'tax-received', detail: 'Cotisations dues à la sécurité sociale, pas encore encaissées' }),
  // The city's social security passes the unemployment fund its share of the contributions received that month (see SocialFundsCatalog.js): it moves no money.
  od_social_allocation: Object.freeze({ debit: '431', credit: '4378', label: 'Répartition des cotisations', tone: 'personnel', detail: 'Une part des cotisations reçues revient à la caisse chômage' }),
  // The owner holds the buildings the city paid for: they enter its books as fixed assets (213) against the city's contribution in kind (capital, 101).
  od_asset_contribution: Object.freeze({ debit: '213', credit: '101', label: 'Constructions apportées par la ville', tone: 'fixed-asset', detail: 'Un bâtiment payé par la ville entre dans le patrimoine de la SCI' }),
  // A building that is gone leaves the owner's books: its depreciation so far is released, and what it was still worth is a loss (675).
  od_asset_disposal_amortization: Object.freeze({ debit: '281', credit: '213', label: 'Amortissements des constructions démolies', tone: 'fixed-asset', detail: 'Un bâtiment démoli sort du patrimoine : son amortissement est soldé' }),
  od_asset_disposal_loss: Object.freeze({ debit: '675', credit: '213', label: 'Valeur nette des constructions démolies', tone: 'external', detail: 'Ce que le bâtiment démoli valait encore dans les livres' }),
  // The year's interest on savings is capitalised, as a savings account is: the house's claim on its bank (275) grows by it, and so does what the bank owes (165).
  od_deposit_interest_credited: Object.freeze({ debit: '275', credit: '768', label: 'Autres produits financiers', tone: 'treasury', detail: 'Intérêts de l’épargne ajoutés au dépôt en banque', household: true }),
  od_deposit_interest_owed: Object.freeze({ debit: '6615', credit: '165', label: 'Intérêts des comptes courants et des dépôts créditeurs', tone: 'financial', detail: 'Intérêts de l’épargne ajoutés aux dépôts des clients' }),
  // A State's central bank holds no money of its own (docs/gameplay/PLAN_BANK_MONEY.md): what it is paid leaves circulation, what it pays is money it issues or the
  // Treasury's account it credits. The interest the bank pays it is money withdrawn (1678) against its product (7626); the profit it pays its State is a distribution
  // of its result (457) credited to the Treasury's account (1674).
  od_refinancing_interest_received: Object.freeze({ debit: '1678', credit: '7626', label: 'Revenus des prêts', tone: 'sales', detail: 'Intérêts du refinancement payés par la banque : la monnaie revient à la banque centrale' }),
  od_central_bank_profit_paid: Object.freeze({ debit: '457', credit: '1674', label: 'Associés — dividendes à payer', tone: 'financial', detail: 'Résultat de la banque centrale versé au compte du Trésor' }),
  // The Treasury's account at its central bank kept level with the State's money, once a month (BankRefinancing.centraliseTreasury, the écriture de centralisation):
  // what the State received from the public is money that came back (1678 debited), what it paid is money issued (1678 credited); the State's founding endowment is
  // the money the central bank created for it once (2768).
  od_treasury_founding: Object.freeze({ debit: '2768', credit: '1674', label: 'Compte du Trésor', tone: 'capital', detail: 'Monnaie créée par la banque centrale à la fondation de l’État' }),
  od_treasury_inflow: Object.freeze({ debit: '1678', credit: '1674', label: 'Compte du Trésor', tone: 'treasury', detail: 'Ce que l’État a encaissé dans le mois : la monnaie revient à la banque centrale' }),
  od_treasury_outflow: Object.freeze({ debit: '1674', credit: '1678', label: 'Compte du Trésor', tone: 'treasury', detail: 'Ce que l’État a payé dans le mois : de la monnaie émise' }),
  // The bank's money (docs/gameplay/PLAN_BANK_MONEY.md, step 3): what its customers hold (their 512) is its debt to them, its sight deposits (1651); its own money is
  // its reserves on its account at the central bank (5151). Once a month (BankRefinancing.centraliseBank, from balances) its own cash is put on its reserves, and its
  // deposits are brought level with what its customers hold: a payment between two customers moves neither, a loan to a customer raises the deposits without touching
  // the reserves, a payment out of the bank (the State, abroad) takes reserves. The central bank holds the banks' reserves as its debt (1673): what the bank holds there
  // is money it issued, now held as reserves.
  od_bank_cash_to_reserves: Object.freeze({ debit: '5151', credit: '512', label: 'Réserves à la banque centrale', tone: 'treasury', detail: 'La trésorerie de la banque portée sur son compte à la banque centrale' }),
  od_bank_reserves_to_cash: Object.freeze({ debit: '512', credit: '5151', label: 'Réserves à la banque centrale', tone: 'treasury', detail: 'Les paiements de la banque pris sur son compte à la banque centrale' }),
  od_deposits_up: Object.freeze({ debit: '5151', credit: '1651', label: 'Dépôts à vue de la clientèle', tone: 'treasury', detail: 'Ce que ses clients ont reçu de l’extérieur dans le mois : leurs dépôts et les réserves de la banque' }),
  od_deposits_down: Object.freeze({ debit: '1651', credit: '5151', label: 'Dépôts à vue de la clientèle', tone: 'treasury', detail: 'Ce que ses clients ont payé à l’extérieur dans le mois : leurs dépôts et les réserves de la banque' }),
  od_reserves_held_up: Object.freeze({ debit: '1678', credit: '1673', label: 'Réserves des banques', tone: 'treasury', detail: 'De la monnaie émise, désormais tenue en réserves par la banque' }),
  od_reserves_held_down: Object.freeze({ debit: '1673', credit: '1678', label: 'Réserves des banques', tone: 'treasury', detail: 'Des réserves de la banque sorties en monnaie' }),
  // What the State's economy received from abroad (an export sold) or paid there (an import, an upkeep paid outside the game), once a month from balances
  // (BankRefinancing.centraliseExternal): the central bank converts the foreign money, so it holds foreign reserves (2761) against the money it issued for them (1678);
  // what is paid abroad gives them back.
  od_foreign_reserves_in: Object.freeze({ debit: '2761', credit: '1678', label: 'Avoirs en devises', tone: 'treasury', detail: 'L’argent venu de l’étranger dans le mois : la banque centrale l’a converti' }),
  od_foreign_reserves_out: Object.freeze({ debit: '1678', credit: '2761', label: 'Avoirs en devises', tone: 'treasury', detail: 'L’argent payé à l’étranger dans le mois : la banque centrale a cédé des devises' }),
  // A bank that is liquidated (LiquidateDemolishedBuilding.js): its customers' sight deposits are paid out in central bank money (banknotes, as in a State without a
  // bank) out of its reserves, and the central bank's reserves for it become money issued; reserves below nothing at the end are abandoned by the bank and lost by the
  // central bank.
  od_sight_deposits_released: Object.freeze({ debit: '1651', credit: '5151', label: 'Dépôts à vue de la clientèle', tone: 'treasury', detail: 'Les dépôts des clients rendus en billets à la liquidation de la banque' }),
  od_reserves_released: Object.freeze({ debit: '1673', credit: '1678', label: 'Réserves des banques', tone: 'treasury', detail: 'Les réserves de la banque liquidée sorties en billets' }),
  od_reserves_overdraft_abandoned: Object.freeze({ debit: '5151', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Le découvert de la banque liquidée à la banque centrale ne sera jamais remboursé' }),
  od_reserves_overdraft_loss: Object.freeze({ debit: '654', credit: '1673', label: 'Pertes sur créances irrécouvrables', tone: 'external', detail: 'Le découvert d’une banque liquidée ne sera jamais remboursé' }),
  // The central bank lends by creating money: its loan to the bank (274) against the money it issued (1678, see EXTRA_ACCOUNT_LABELS). The repayment destroys it again.
  od_refinancing_issued: Object.freeze({ debit: '274', credit: '1678', label: 'Prêts', tone: 'loan', detail: 'Monnaie créée pour refinancer la banque' }),
  od_refinancing_retired: Object.freeze({ debit: '1678', credit: '274', label: 'Prêts', tone: 'loan-repayment', detail: 'Monnaie détruite au remboursement du refinancement' }),
  // A month's interest the bank cannot pay in cash is added to what it owes (no money moves): a charge of the bank against its debt, a product of the central bank against its loan.
  od_refinancing_interest_capitalised: Object.freeze({ debit: '6611', credit: '1649', label: 'Intérêts des emprunts et dettes', tone: 'financial', detail: 'Intérêts du refinancement ajoutés à la dette, faute de trésorerie' }),
  od_refinancing_interest_accrued: Object.freeze({ debit: '274', credit: '7626', label: 'Revenus des prêts', tone: 'sales', detail: 'Intérêts du refinancement ajoutés au prêt à la banque' }),
  // The marginal lending's interest the bank cannot pay is added to its debt; the debt it never repays is abandoned (the central bank's loss is od_refinancing_loss).
  od_marginal_interest_capitalised: Object.freeze({ debit: '6611', credit: '1648', label: 'Intérêts des emprunts et dettes', tone: 'financial', detail: 'Intérêts du prêt marginal ajoutés à la dette, faute de réserves' }),
  od_marginal_abandoned: Object.freeze({ debit: '1648', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Le prêt marginal ne sera jamais remboursé : la dette est abandonnée' }),
  // The deposit facility: the central bank pays a bank each month on the reserves it holds above the reserve due, credited to its account there (no cash moves).
  od_reserves_interest_received: Object.freeze({ debit: '5151', credit: '768', label: 'Autres produits financiers', tone: 'sales', detail: 'Intérêts de la facilité de dépôt sur les réserves au-delà de la réserve due' }),
  od_reserves_interest_paid: Object.freeze({ debit: '6615', credit: '1673', label: 'Intérêts des comptes courants et des dépôts créditeurs', tone: 'financial', detail: 'Intérêts de la facilité de dépôt versés sur les réserves des banques' }),
  // A company's credit: the interest it cannot pay in cash is added to what it owes, as the bank's refinancing.
  od_bank_credit_interest_capitalised: Object.freeze({ debit: '6611', credit: '1643', label: 'Intérêts des emprunts et dettes', tone: 'financial', detail: 'Intérêts du crédit de la banque ajoutés à la dette, faute de trésorerie' }),
  od_bank_credit_interest_accrued: Object.freeze({ debit: '274', credit: '7626', label: 'Revenus des prêts', tone: 'sales', detail: 'Intérêts du crédit ajoutés au prêt à l’entreprise' }),
  // What a liquidation cannot repay of a credit: the debtor is released (7718), the lender bears the loss (654) — a company's credit to the bank, the bank's refinancing
  // to the central bank, the savings of a liquidated bank's depositors (which the city then guarantees, deposit_guarantee).
  od_bank_credit_abandoned: Object.freeze({ debit: '1643', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Le crédit de la banque ne sera jamais remboursé : la dette est abandonnée' }),
  od_bank_credit_loss: Object.freeze({ debit: '654', credit: '274', label: 'Pertes sur créances irrécouvrables', tone: 'external', detail: 'Un crédit à une entreprise liquidée ne sera jamais remboursé' }),
  od_refinancing_abandoned: Object.freeze({ debit: '1649', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'Le refinancement ne sera jamais remboursé : la dette est abandonnée' }),
  od_refinancing_loss: Object.freeze({ debit: '654', credit: '274', label: 'Pertes sur créances irrécouvrables', tone: 'external', detail: 'Le refinancement d’une banque liquidée ne sera jamais remboursé' }),
  // The part of a saver's savings beyond the guarantee cap that a liquidated bank cannot give back: the saver loses it (its claim 275 closes against a loss, 654).
  od_deposit_lost: Object.freeze({ debit: '654', credit: '275', label: 'Pertes sur créances irrécouvrables', tone: 'external', detail: 'L’épargne au-delà du plafond de la garantie, que la banque liquidée ne peut rendre', household: true }),
  od_deposit_abandoned: Object.freeze({ debit: '165', credit: '7718', label: 'Abandons de créances obtenus', tone: 'sales', detail: 'L’épargne que la banque liquidée ne peut rendre : la ville la garantit' }),
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
    return Object.freeze({ ...own, tone: od.tone, journal: 'OD', plans: Object.freeze({ pcg: own }), ...(od.household ? { household: true } : {}) });
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
const NO_COUNTERPART_TYPES = Object.freeze(new Set(['capital_funds', 'construction', 'construction_refund', 'maintenance', 'exceptional_expenses', 'commercial_route', 'contribution', 'liquidation_stock_sale']));
const NO_COUNTERPART_PREFIXES = Object.freeze(['import_', 'freight_', 'abroad_sale_']);
/** The opérations diverses that are one side of a flow: the rent a company owes its owner is the owner's receivable. */
const PAIRED_OPERATIONS = Object.freeze(new Set([
  'od_payable_premises_rent', 'od_receivable_premises_rent', 'od_payable_corporate_tax', 'od_receivable_corporate_tax', 'od_payable_contribution', 'od_receivable_contribution',
  'od_deposit_interest_credited', 'od_deposit_interest_owed',
  'od_refinancing_issued', 'od_refinancing_retired', 'od_refinancing_interest_capitalised', 'od_refinancing_interest_accrued',
  'od_refinancing_interest_received', 'od_central_bank_profit_paid',
  'od_deposit_lost', 'od_marginal_interest_capitalised', 'od_marginal_abandoned', 'od_reserves_interest_received', 'od_reserves_interest_paid',
  'od_bank_credit_interest_capitalised', 'od_bank_credit_interest_accrued', 'od_bank_credit_abandoned', 'od_bank_credit_loss', 'od_refinancing_abandoned', 'od_refinancing_loss',
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
  '515': 'Compte au Trésor',
  '53': 'Caisse',
  '12': 'Résultat reporté (années clôturées)',
  '275': 'Dépôts et cautionnements versés',
  '165': 'Dépôts et cautionnements reçus',
  // The PCG has no account for a central bank's money (it keeps a chart of its own): 1678, the debts "assortis de conditions particulières", is the nearest, a
  // liability no creditor asks back. The game books on it what the central bank issued and has not had back.
  '1678': 'Monnaie émise par la banque centrale',
  // A State's central bank: the account it holds for its Treasury (a debt of it, as the Banque de France's to the Trésor), and the money it created once for the
  // State at its founding (a claim never repaid: the endowment of a new country). Game accounts, as 1678: the PCG has no chart for a central bank.
  '1674': 'Compte du Trésor à la banque centrale',
  '1673': 'Réserves des banques à la banque centrale',
  '1648': 'Prêt marginal de la banque centrale',
  '5151': 'Réserves à la banque centrale',
  '1651': 'Dépôts à vue de la clientèle',
  '2768': 'Dotation monétaire de la fondation de l’État',
  '2761': 'Avoirs en devises (réserves de change)',
  '768': 'Autres produits financiers',
  '35': 'Stocks de produits',
  '37': 'Stocks de marchandises',
  '281': 'Amortissements des immobilisations corporelles',
  '6037': 'Variation des stocks de marchandises',
  '713': 'Variation des stocks de produits',
  '6811': 'Dotations aux amortissements des immobilisations',
  '675': 'Valeurs comptables des éléments d’actif cédés',
  '7718': 'Autres produits exceptionnels sur opérations de gestion',
  '654': 'Pertes sur créances irrécouvrables',
  '6541': 'Créances admises en non-valeur',
  '431': 'Sécurité sociale',
  '4378': 'Autres organismes sociaux – Divers',
  '4372': 'Mutuelles',
  '658': 'Charges diverses de gestion courante',
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
