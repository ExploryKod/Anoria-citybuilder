/**
 * The account a journal line moves. The city's account has no holder. A company has one account, its building's. A house
 * has its personal account (the wages it receives, the services and goods it pays) and one business account per enterprise it runs
 * (what a cooperative sells, what a property company collects): each enterprise is a legal person of its own, so each has its own account.
 * One key per account, so every balance is read the same way.
 */
export const PERSONAL_ACCOUNT = 'particulier';
const BUSINESS_ACCOUNT_PREFIX = 'entreprise:';

/**
 * The kind of a house's business account for one of its enterprises (the id the catalog gives it: `cooperative`, `sci`...).
 * @param {string} enterpriseId
 * @returns {string} e.g. `entreprise:sci`
 */
export function businessAccountOf(enterpriseId) {
  if (typeof enterpriseId !== 'string' || enterpriseId.length === 0) throw new Error(`[journal] a business account needs the id of its enterprise, got ${enterpriseId}`);
  return `${BUSINESS_ACCOUNT_PREFIX}${enterpriseId}`;
}

/** @param {unknown} accountKind @returns {boolean} whether it is the business account of some enterprise */
export function isBusinessAccount(accountKind) {
  return typeof accountKind === 'string' && accountKind.startsWith(BUSINESS_ACCOUNT_PREFIX) && accountKind.length > BUSINESS_ACCOUNT_PREFIX.length;
}

/** @param {string} accountKind a business account's kind @returns {string} the id of its enterprise */
export function enterpriseIdOfAccount(accountKind) {
  if (!isBusinessAccount(accountKind)) throw new Error(`[journal] "${accountKind}" is not the business account of an enterprise`);
  return accountKind.slice(BUSINESS_ACCOUNT_PREFIX.length);
}

/**
 * @param {{ accountBuildingId?: string | null, accountKind?: string | null }} line
 * @returns {string | null} the account's key, or null for the city's account
 */
export function accountKeyOf({ accountBuildingId = null, accountKind = null }) {
  if (accountBuildingId === null) {
    if (accountKind !== null) throw new Error(`[journal] a "${accountKind}" account needs its house`);
    return null;
  }
  if (accountKind === null) return accountBuildingId;
  if (accountKind !== PERSONAL_ACCOUNT && !isBusinessAccount(accountKind)) throw new Error(`[journal] unknown account kind "${accountKind}"`);
  return `${accountBuildingId}/${accountKind}`;
}
