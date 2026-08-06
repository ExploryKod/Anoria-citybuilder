/**
 * Supply-chain building type helpers (windmill / market).
 */

const MARKET_TYPE_PREFIXES = ['Market-Stall', 'Market'];

const WINDMILL_TYPE_PREFIXES = ['Windmill'];

/**
 * @param {string | null | undefined} buildingType
 */
export function isMarketBuildingType(buildingType) {
  if (!buildingType || typeof buildingType !== 'string') return false;
  return MARKET_TYPE_PREFIXES.some(
    (prefix) => buildingType === prefix || buildingType.startsWith(`${prefix}-`)
  );
}

/**
 * @param {string | null | undefined} buildingType
 */
export function isWindmillBuildingType(buildingType) {
  if (!buildingType || typeof buildingType !== 'string') return false;
  return (
    buildingType.includes('Windmill')
    || buildingType.includes('windmill')
    || WINDMILL_TYPE_PREFIXES.some((prefix) => buildingType.startsWith(prefix))
  );
}
