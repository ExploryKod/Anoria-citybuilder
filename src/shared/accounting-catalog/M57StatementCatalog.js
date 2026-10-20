/**
 * The statements of the city and the hamlets, in the model of the M57 chart of accounts (abrégé, 1er janvier 2026): the compte de résultat reads the charges
 * (class 6) and the products (class 7) by family of account, the balance sheet the balance-sheet accounts (classes 1 to 5) by nature. Like a company's statements
 * (INCOME_STATEMENT), they are derived from the fold of the journal's legs and written nowhere.
 *
 * Each line says the accounts that feed it (an account number, or the start of one: `73` is every 73x); an account of class 6 or 7 that no line takes throws.
 */

/** @typedef {{ id: string, label: string, accounts: ReadonlyArray<string>, tone: string }} M57Line the colour family of the line is the journal's (see PcgJournalCatalog's tones) */
/** @typedef {{ id: string, label: string, side: 'product' | 'charge', lines: ReadonlyArray<M57Line> }} M57Section */

/** @type {ReadonlyArray<M57Section>} */
export const M57_INCOME_STATEMENT = Object.freeze([
  Object.freeze({
    id: 'operatingProducts', label: 'Produits de fonctionnement', side: 'product',
    lines: Object.freeze([
      Object.freeze({ id: 'services', label: 'Produits des services, du domaine et ventes diverses', accounts: Object.freeze(['70', '71', '72']), tone: 'sales' }),
      Object.freeze({ id: 'taxes', label: 'Impôts et taxes', accounts: Object.freeze(['73']), tone: 'tax-received' }),
      Object.freeze({ id: 'grants', label: 'Dotations et participations', accounts: Object.freeze(['74']), tone: 'subsidy-received' }),
      Object.freeze({ id: 'otherProducts', label: 'Autres produits de gestion courante', accounts: Object.freeze(['75', '78', '79']), tone: 'sales' }),
    ]),
  }),
  Object.freeze({
    id: 'operatingCharges', label: 'Charges de fonctionnement', side: 'charge',
    lines: Object.freeze([
      Object.freeze({ id: 'purchases', label: 'Achats et variation des stocks', accounts: Object.freeze(['60']), tone: 'purchase' }),
      Object.freeze({ id: 'externalServices', label: 'Services extérieurs', accounts: Object.freeze(['61', '62']), tone: 'external' }),
      Object.freeze({ id: 'taxesPaid', label: 'Impôts, taxes et versements assimilés', accounts: Object.freeze(['63']), tone: 'tax-paid' }),
      Object.freeze({ id: 'staff', label: 'Charges de personnel', accounts: Object.freeze(['64']), tone: 'personnel' }),
      Object.freeze({ id: 'otherCharges', label: 'Autres charges de gestion courante', accounts: Object.freeze(['65']), tone: 'subsidy-given' }),
      Object.freeze({ id: 'depreciation', label: 'Dotations aux amortissements', accounts: Object.freeze(['68']), tone: 'external' }),
    ]),
  }),
  Object.freeze({
    id: 'financialProducts', label: 'Produits financiers', side: 'product',
    lines: Object.freeze([Object.freeze({ id: 'financialProductsLine', label: 'Produits financiers', accounts: Object.freeze(['76']), tone: 'sales' })]),
  }),
  Object.freeze({
    id: 'financialCharges', label: 'Charges financières', side: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'financialChargesLine', label: 'Charges d’intérêts et autres charges financières', accounts: Object.freeze(['66']), tone: 'financial' })]),
  }),
  Object.freeze({
    id: 'specificProducts', label: 'Produits spécifiques', side: 'product',
    lines: Object.freeze([Object.freeze({ id: 'specificProductsLine', label: 'Produits spécifiques (cessions, subventions transférées)', accounts: Object.freeze(['77']), tone: 'sales' })]),
  }),
  Object.freeze({
    id: 'specificCharges', label: 'Charges spécifiques', side: 'charge',
    lines: Object.freeze([Object.freeze({ id: 'specificChargesLine', label: 'Charges spécifiques (valeur des actifs cédés)', accounts: Object.freeze(['67']), tone: 'external' })]),
  }),
]);

/**
 * @param {string} account an account of class 6 or 7
 * @returns {{ section: M57Section, line: M57Line } | null} the line of the compte de résultat that takes it (the one naming the longest start of it), null when none does
 */
export function m57LineOfAccount(account) {
  let best = null;
  for (const section of M57_INCOME_STATEMENT) {
    for (const line of section.lines) {
      for (const prefix of line.accounts) {
        if (account.startsWith(prefix) && (best === null || prefix.length > best.prefix.length)) best = { prefix, section, line };
      }
    }
  }
  return best && { section: best.section, line: best.line };
}

/**
 * The groups of the balance sheet, by nature. An account with a debit balance is on the asset side, one with a credit balance on the liability side, whatever its
 * class: a debt of the city to the social body (431) turns into a receivable when it is overdrawn, the bank into an overdraft below nothing. The accounts of
 * the equity (class 1 but the loans) and the result are always on the liability side.
 */
export const M57_BALANCE_GROUPS = Object.freeze({
  assets: Object.freeze([
    Object.freeze({ id: 'fixedAssets', label: 'Immobilisations', accounts: Object.freeze(['2']), tone: 'fixed-asset' }),
    Object.freeze({ id: 'stocks', label: 'Stocks', accounts: Object.freeze(['3']), tone: 'external' }),
    Object.freeze({ id: 'receivables', label: 'Créances', accounts: Object.freeze(['4']), tone: 'tax-received' }),
    Object.freeze({ id: 'cash', label: 'Trésorerie', accounts: Object.freeze(['5']), tone: 'treasury' }),
  ]),
  liabilities: Object.freeze([
    Object.freeze({ id: 'equity', label: 'Fonds propres', accounts: Object.freeze(['10', '11', '12', '13', '14', '15']), tone: 'capital' }),
    Object.freeze({ id: 'loans', label: 'Emprunts et dettes assimilées', accounts: Object.freeze(['16', '17', '18']), tone: 'loan-repayment' }),
    Object.freeze({ id: 'debts', label: 'Dettes', accounts: Object.freeze(['4']), tone: 'tax-paid' }),
    Object.freeze({ id: 'overdraft', label: 'Concours bancaires (compte sous zéro)', accounts: Object.freeze(['5']), tone: 'purchase' }),
  ]),
});
