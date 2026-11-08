import { listTradePartnerIds } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * The gift of a partner city (docs/gameplay/PLAN_BANK_MONEY.md): when the city has no money left and trades with a partner city, that city, curious to see it grow, offers
 * it a sum to start. The player accepts or refuses (for now it costs nothing to refuse; later it could). The gift is money from abroad, a capital gift of the State (M57 1025,
 * `benefactor_gift`), converted by the central bank like any money that comes from another State; it is not the founding treasure (that is the city's own dotation, 1021).
 *
 *   - `amount`: euros;
 *   - `firstYears`: the offer can only be made during the game's first years (years 0 to `firstYears` - 1); later the partner cities no longer take the city for a newcomer;
 *   - `benefactors`: the cities that may offer it, in order of priority: when several are commercial partners at once, index 0 is the one that offers.
 *     A city that is not in the list never offers (every id must be a trade partner of the trade catalog).
 */
export const BENEFACTOR_GIFT = Object.freeze({
  amount: 2000,
  firstYears: 5,
  benefactors: Object.freeze(['olivea', 'silvania', 'briga', 'piceta', 'maris']),
});

const known = new Set(listTradePartnerIds());
for (const cityId of BENEFACTOR_GIFT.benefactors) {
  if (!known.has(cityId)) throw new Error(`[benefactor-gift] "${cityId}" is a benefactor of the gift but not a city of the trade catalog`);
}
