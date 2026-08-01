/**
 * Map TimeManager French season/month labels → Supply English catalogs.
 */

const LEGACY_SEASON_TO_SUPPLY = Object.freeze({
  Printemps: 'spring',
  Été: 'summer',
  Automne: 'autumn',
  Hiver: 'winter',
});

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
