/**
 * Generic hub↔distributor link mechanics — the pattern behind "market
 * restocks from its windmill" generalized to any hub/distributor pair
 * (warehouse, granary, ...). Resource-agnostic: categories are always a
 * parameter, never a hardcoded crop list.
 *
 * The persisted link shape (`{ marketId, x, y, allocatedStocks }`, saved
 * via `saveLinkedMarkets`) keeps its field names as-is — that's the actual
 * Dexie schema, and renaming persisted keys is a save-game migration
 * concern, not a refactor. Only the algorithm around it is generic; a
 * `distributorId` parameter here still writes into a `marketId` key.
 *
 * Placement-time owner discovery (picking which hub a newly placed
 * distributor belongs to, `WindmillMarketLinkPolicy.canPlaceMarketAt`) is
 * deliberately not generalized yet — it's a separate, riskier slice
 * (placement validation, not a monthly tick) to be done next.
 */

/**
 * Split a hub's stock evenly across its linked distributors (largest
 * remainder gets the leftover units first, stable by link order).
 *
 * @param {Record<string, number>} hubStocks
 * @param {Array<{ marketId: string, x: number, y: number, allocatedStocks: Record<string, number> }>} linkedDistributors
 * @param {string[]} categories
 * @returns {Array<{ marketId: string, x: number, y: number, allocatedStocks: Record<string, number> }>}
 */
export function computeHubAllocations(hubStocks, linkedDistributors, categories) {
  const links = Array.isArray(linkedDistributors) ? linkedDistributors : [];
  const count = links.length;
  if (count === 0) return [];

  return links.map((link, index) => {
    const allocatedStocks = {};
    for (const category of categories) {
      const total = Math.max(0, Math.floor(Number(hubStocks?.[category]) || 0));
      const perDistributor = Math.floor(total / count);
      const remainder = total % count;
      allocatedStocks[category] = perDistributor + (index < remainder ? 1 : 0);
    }

    return {
      marketId: link.marketId,
      x: link.x,
      y: link.y,
      allocatedStocks,
    };
  });
}

/**
 * @param {Array<object>} linkedDistributors
 * @param {string} distributorId
 * @param {number} x
 * @param {number} y
 * @param {string[]} categories
 * @returns {Array<object>}
 */
export function addHubLink(linkedDistributors, distributorId, x, y, categories) {
  const existing = (linkedDistributors ?? []).filter((entry) => entry.marketId !== distributorId);
  const allocatedStocks = {};
  for (const category of categories) {
    allocatedStocks[category] = 0;
  }
  return [...existing, { marketId: distributorId, x, y, allocatedStocks }];
}

/**
 * @param {Array<object>} linkedDistributors
 * @param {string} distributorId
 * @returns {Array<object>}
 */
export function removeHubLink(linkedDistributors, distributorId) {
  return (linkedDistributors ?? []).filter((entry) => entry.marketId !== distributorId);
}
