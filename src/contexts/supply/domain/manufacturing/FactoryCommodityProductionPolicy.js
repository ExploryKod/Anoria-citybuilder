/**
 * Per-factory, per-commodity production toggle (Cesar III style).
 * Independent of destination cap split (communicating vessels).
 * Missing key ⇒ enabled (backward compatible).
 */

/**
 * @param {object|null|undefined} factory
 * @param {string} commodityId
 */
export function isFactoryCommodityProductionEnabled(factory, commodityId) {
  const flags = factory?.commodityProductionEnabled;
  if (!flags || flags[commodityId] === undefined) {
    return true;
  }
  return flags[commodityId] !== false;
}

/**
 * @param {Record<string, boolean>|null|undefined} current
 * @param {string} commodityId
 * @param {boolean} enabled
 * @returns {Record<string, boolean>}
 */
export function withFactoryCommodityProductionEnabled(current, commodityId, enabled) {
  return {
    ...(current || {}),
    [commodityId]: enabled,
  };
}
