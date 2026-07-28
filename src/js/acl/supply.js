/**
 * ACL Supply — only entry from legacy `src/js/` into the Supply BC.
 *
 * Do not import `contexts/supply/domain/**` from UI or SimServices.
 */

export {
  createSupplyContext,
  getOrCreateSupplyContext,
} from '../../composition/createSupplyContext.js';

export { isWithinMarketRange, manhattanDistance } from '../../contexts/supply/domain/policies/MarketRangePolicy.js';

/** Map TimeManager French season labels → Supply English seasons. */
const LEGACY_SEASON_TO_SUPPLY = Object.freeze({
  Printemps: 'spring',
  Été: 'summer',
  Automne: 'autumn',
  Hiver: 'winter',
});

/** Map TimeManager French month labels → Supply English months. */
const LEGACY_MONTH_TO_SUPPLY = Object.freeze({
  Janvier: 'january',
  Février: 'february',
  Mars: 'march',
  Avril: 'april',
  Mai: 'may',
  Juin: 'june',
  Juillet: 'july',
  Août: 'august',
  Septembre: 'september',
  Octobre: 'october',
  Novembre: 'november',
  Décembre: 'december',
});

/**
 * @param {string | null | undefined} legacySeason
 * @returns {'spring' | 'summer' | 'autumn' | 'winter' | null}
 */
export function toSupplySeason(legacySeason) {
  if (!legacySeason || typeof legacySeason !== 'string') return null;
  return LEGACY_SEASON_TO_SUPPLY[legacySeason] ?? null;
}

/**
 * @param {string | null | undefined} legacyMonth
 * @returns {'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december' | null}
 */
export function toSupplyMonth(legacyMonth) {
  if (!legacyMonth || typeof legacyMonth !== 'string') return null;
  return LEGACY_MONTH_TO_SUPPLY[legacyMonth] ?? null;
}
