import { listTradePartnerIds } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * The cities outside the game that may lend the city money (docs/gameplay/PLAN_OWNERSHIP.md): a partner city lends when the city trades with it. Their money is foreign money
 * (the central bank converts it against its foreign reserves, like any money that comes from another State); the interest and the repayments leave the economy.
 *   - the array is in order of priority: it is the order the lenders are offered in;
 *   - `extraSpread`: what the lender adds to the rate of an external loan, per year (a close, trusting city asks less);
 *   - `maxAmount`: the most it lends in one loan, in euros.
 */
export const EXTERNAL_LENDERS = Object.freeze([
  Object.freeze({ cityId: 'olivea', extraSpread: 0, maxAmount: 3000 }),
  Object.freeze({ cityId: 'silvania', extraSpread: 0.01, maxAmount: 2500 }),
  Object.freeze({ cityId: 'briga', extraSpread: 0.02, maxAmount: 2000 }),
  Object.freeze({ cityId: 'piceta', extraSpread: 0.02, maxAmount: 2000 }),
  Object.freeze({ cityId: 'maris', extraSpread: 0.03, maxAmount: 1500 }),
]);

const known = new Set(listTradePartnerIds());
for (const { cityId } of EXTERNAL_LENDERS) {
  if (!known.has(cityId)) throw new Error(`[external-lender] "${cityId}" is a lender but not a city of the trade catalog`);
}
