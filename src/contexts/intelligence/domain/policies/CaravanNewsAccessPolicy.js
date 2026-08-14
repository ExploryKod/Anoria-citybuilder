/** Prix MVP d'une dépêche caravane (contribution). */
export const CARAVAN_NEWS_PRICE = 10;

/**
 * @param {{ hasOperationalBarn: boolean, hasActiveTradeRoute: boolean }} assets
 * @returns {boolean}
 */
export function canGenerateCaravanNews({ hasOperationalBarn, hasActiveTradeRoute }) {
  return Boolean(hasOperationalBarn && hasActiveTradeRoute);
}
