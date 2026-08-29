/**
 * Trade cities on the hex world map — axial coords + Kenney sprite keys.
 */

/** @type {Readonly<Record<string, { q: number, r: number, sprite: string }>>} */
export const WORLD_CITY_HEX_SITES = Object.freeze({
  anoria: { q: 0, r: 0, sprite: 'capital' },
  olivea: { q: -4, r: 1, sprite: 'village' },
  silvania: { q: 5, r: -2, sprite: 'village' },
  maris: { q: 2, r: 3, sprite: 'port' },
  briga: { q: 4, r: 2, sprite: 'hamlet' },
  vexlor: { q: -5, r: -2, sprite: 'village' },
});

/**
 * @param {string} cityId
 */
export function getWorldCityHexSite(cityId) {
  return WORLD_CITY_HEX_SITES[cityId] ?? null;
}
