import { WORLD_MARKET } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * One month of the world price of a good: it pulls back toward its target and is shaken (WORLD_MARKET).
 * @param {{ index: number, target: number, shock: number }} params `shock`: a draw around 0 in [-1, 1]
 * @returns {number} the new index, within the market's bounds
 */
export function nextWorldIndex({ index, target, shock }) {
  for (const [name, value] of Object.entries({ index, target, shock })) {
    if (!Number.isFinite(value)) throw new Error(`[world-market] ${name} must be a number, got ${value}`);
  }
  if (!(index > 0) || !(target > 0)) throw new Error(`[world-market] the index and its target must be above 0, got ${index} and ${target}`);
  const { reversion, volatility, floor, cap } = WORLD_MARKET;
  const next = Math.exp(Math.log(index) + reversion * (Math.log(target) - Math.log(index)) + volatility * shock);
  return Math.min(cap, Math.max(floor, Math.round(next * 1000) / 1000));
}

/**
 * The price a crop is pulled toward by the world's harvest of the year.
 * @param {number} worldHarvestFactor
 * @returns {number}
 */
export function cropTargetOf(worldHarvestFactor) {
  if (!(worldHarvestFactor > 0)) throw new Error(`[world-market] the world harvest factor must be above 0, got ${worldHarvestFactor}`);
  return worldHarvestFactor ** -WORLD_MARKET.cropCoupling;
}
