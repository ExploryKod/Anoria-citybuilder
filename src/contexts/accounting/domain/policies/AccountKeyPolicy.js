/**
 * The account a journal line moves. The city's account has no holder. A company has one account, its building's. A house
 * has two: its personal account (the wages it receives, the services and goods it pays) and its business account (what it
 * sells, as goods or as deals). One key per account, so every balance is read the same way.
 */
export const PERSONAL_ACCOUNT = 'particulier';
export const BUSINESS_ACCOUNT = 'entreprise';
export const ACCOUNT_KINDS = Object.freeze([PERSONAL_ACCOUNT, BUSINESS_ACCOUNT]);

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
  if (!ACCOUNT_KINDS.includes(accountKind)) throw new Error(`[journal] unknown account kind "${accountKind}"`);
  return `${accountBuildingId}/${accountKind}`;
}
