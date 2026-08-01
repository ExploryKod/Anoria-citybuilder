/** @typedef {'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december'} Month */

/**
 * Windmills collect surplus from farms only in December (after autumn market buys).
 * @param {Month | string | null | undefined} month
 */
export function canWindmillCollectFromFarms(month) {
  return month === 'december';
}
