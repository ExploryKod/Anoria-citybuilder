import { CROPS } from '../value-objects/CropType.js';
import { isWithinRange, manhattanDistance } from './ResourceRangePolicy.js';

export const MAX_MARKETS_PER_WINDMILL = 2;
export const WINDMILL_MARKET_RANGE = 5;

/**
 * @typedef {object} WindmillMarketLink
 * @property {string} marketId
 * @property {number} x
 * @property {number} y
 * @property {{ wheat: number, carrot: number, cabbage: number }} allocatedStocks
 */

/**
 * @typedef {object} WindmillPlacementCandidate
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} [roadCount]
 * @property {WindmillMarketLink[]} [linkedMarkets]
 */

/**
 * @param {string | null | undefined} type
 */
export function isWindmillType(type) {
  if (!type) return false;
  return type.includes('Windmill') || type.includes('windmill');
}

/**
 * @param {string | null | undefined} type
 */
export function isMarketType(type) {
  if (!type) return false;
  return type.includes('Market') || type.includes('market');
}

/**
 * @param {{ x?: number | null, y?: number | null }} a
 * @param {{ x?: number | null, y?: number | null }} b
 * @param {number} [maxDistance]
 */
export function isWithinWindmillMarketRange(a, b, maxDistance = WINDMILL_MARKET_RANGE) {
  return isWithinRange(a, b, maxDistance);
}

/**
 * Rank windmill candidates for a new market placement (closest first, stable tie-break).
 *
 * @param {{ x: number, y: number }} marketPos
 * @param {WindmillPlacementCandidate[]} windmills
 * @param {number} [maxDistance]
 * @returns {WindmillPlacementCandidate[]}
 */
export function rankWindmillCandidatesForMarket(marketPos, windmills, maxDistance = WINDMILL_MARKET_RANGE) {
  return [...windmills]
    .filter((windmill) => {
      if (windmill.x == null || windmill.y == null) return false;
      if ((windmill.roadCount ?? 0) <= 0) return false;
      if (!isWithinWindmillMarketRange(marketPos, windmill, maxDistance)) return false;
      const linkedCount = windmill.linkedMarkets?.length ?? 0;
      return linkedCount < MAX_MARKETS_PER_WINDMILL;
    })
    .sort((a, b) => {
      const distA = manhattanDistance(marketPos, a);
      const distB = manhattanDistance(marketPos, b);
      if (distA !== distB) return distA - distB;
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Pick the owning windmill for a market at placement time.
 *
 * @param {{ x: number, y: number }} marketPos
 * @param {WindmillPlacementCandidate[]} windmills
 * @param {number} [maxDistance]
 * @returns {WindmillPlacementCandidate | null}
 */
export function pickOwningWindmillForMarket(marketPos, windmills, maxDistance = WINDMILL_MARKET_RANGE) {
  const ranked = rankWindmillCandidatesForMarket(marketPos, windmills, maxDistance);
  return ranked[0] ?? null;
}

/**
 * Pure placement gate for markets (footprint must be checked separately).
 *
 * @param {object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {WindmillPlacementCandidate[]} params.windmills
 * @param {number} [params.maxDistance]
 * @returns {{ ok: boolean, reason?: string, ownerWindmillId?: string }}
 */
export function canPlaceMarketAt({ x, y, windmills, maxDistance = WINDMILL_MARKET_RANGE }) {
  if (!windmills || windmills.length === 0) {
    return { ok: false, reason: 'no_windmill' };
  }

  const owner = pickOwningWindmillForMarket({ x, y }, windmills, maxDistance);
  if (owner) {
    return { ok: true, ownerWindmillId: owner.id };
  }

  const hasNearbyWindmill = windmills.some((windmill) => {
    if (windmill.x == null || windmill.y == null) return false;
    return isWithinWindmillMarketRange({ x, y }, windmill, maxDistance);
  });

  if (hasNearbyWindmill) {
    return { ok: false, reason: 'windmill_full' };
  }

  return { ok: false, reason: 'windmill_too_far' };
}

/**
 * Split windmill crop stocks evenly across linked markets.
 *
 * @param {{ wheat?: number, carrot?: number, cabbage?: number }} windmillStocks
 * @param {WindmillMarketLink[]} linkedMarkets
 * @returns {WindmillMarketLink[]}
 */
export function computeMarketAllocations(windmillStocks, linkedMarkets) {
  const markets = Array.isArray(linkedMarkets) ? linkedMarkets : [];
  const count = markets.length;
  if (count === 0) return [];

  return markets.map((market, index) => {
    /** @type {{ wheat: number, carrot: number, cabbage: number }} */
    const allocatedStocks = { wheat: 0, carrot: 0, cabbage: 0 };

    for (const crop of CROPS) {
      const total = Math.max(0, Math.floor(Number(windmillStocks?.[crop]) || 0));
      const perMarket = Math.floor(total / count);
      const remainder = total % count;
      allocatedStocks[crop] = perMarket + (index < remainder ? 1 : 0);
    }

    return {
      marketId: market.marketId,
      x: market.x,
      y: market.y,
      allocatedStocks,
    };
  });
}

/**
 * @param {WindmillMarketLink[]} linkedMarkets
 * @param {string} marketId
 * @param {number} x
 * @param {number} y
 * @returns {WindmillMarketLink[]}
 */
export function addMarketLink(linkedMarkets, marketId, x, y) {
  const existing = (linkedMarkets ?? []).filter((entry) => entry.marketId !== marketId);
  return [
    ...existing,
    {
      marketId,
      x,
      y,
      allocatedStocks: { wheat: 0, carrot: 0, cabbage: 0 },
    },
  ];
}

/**
 * @param {WindmillMarketLink[]} linkedMarkets
 * @param {string} marketId
 * @returns {WindmillMarketLink[]}
 */
export function removeMarketLink(linkedMarkets, marketId) {
  return (linkedMarkets ?? []).filter((entry) => entry.marketId !== marketId);
}
