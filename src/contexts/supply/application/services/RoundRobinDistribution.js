/**
 * Splits `available` units between takers so nobody gets more than their cap
 * and nobody is served before the smaller needs are met: the small needs are
 * filled fully, what is left is shared equally between the others. One pass,
 * no per-unit loop. `Infinity` caps are allowed (an equal split).
 *
 * @param {number[]} caps Most each taker can still receive.
 * @param {number} available
 * @returns {number[]} Units for each taker, same order as `caps`.
 */
export function fairShares(caps, available) {
  const order = caps.map((_, index) => index).sort((a, b) => (caps[a] < caps[b] ? -1 : caps[a] > caps[b] ? 1 : 0));
  const shares = new Array(caps.length).fill(0);
  let left = Math.max(0, Math.floor(available));
  order.forEach((index, rank) => {
    const equal = Math.floor(left / (order.length - rank));
    shares[index] = Math.max(0, Math.min(caps[index], equal));
    left -= shares[index];
  });
  return shares;
}

/**
 * Generic distribution: a source stock is shared between its eligible consumers
 * by `fairShares`, each consumer capped by what it still needs (`getCap`, unlimited
 * by default). Each consumer is read once and written once; its share is drawn
 * across the categories in turn, starting from a rotating one, so the variety of
 * goods is spread instead of one good being emptied first. Resource-agnostic — callers pass the stock
 * operations (create/take/add/getAmount) so any circuit (food crops, factory
 * goods, ...) can reuse the same algorithm without this module knowing what a
 * "crop" or a "house" is.
 *
 * @param {object} params
 * @param {readonly string[]} params.categories
 * @param {object} params.sourceStock - already-loaded source stock
 * @param {string[]} params.consumerIds
 * @param {(consumer: object) => boolean} params.isEligible - road/operational gate, given the fetched consumer record
 * @param {{ findById(id: string): Promise<any>, saveStocks(id: string, stock: object): Promise<void> }} params.repository
 * @param {(raw?: object) => object} params.createStock
 * @param {(stock: object, category: string, amount: number) => object} params.takeCategory
 * @param {(stock: object, category: string, amount: number) => object} params.addCategory
 * @param {(stock: object, category: string) => number} params.getAmount
 * @param {(consumer: object) => number} [params.getCap] Units the consumer can still take (default: no limit)
 * @returns {Promise<{
 *   transfers: Array<{ consumerId: string, category: string, amount: number }>,
 *   sourceStock: object,
 * }>}
 */
export async function distributeRoundRobin({
  categories,
  sourceStock,
  consumerIds,
  isEligible,
  repository,
  createStock,
  takeCategory,
  addCategory,
  getAmount,
  getCap = () => Infinity,
}) {
  const takers = [];
  for (const consumerId of consumerIds) {
    const consumer = await repository.findById(consumerId);
    if (!consumer || !isEligible(consumer)) continue;
    const cap = getCap(consumer);
    takers.push({ consumerId, stock: createStock(consumer.stocks), cap: Number.isNaN(cap) ? 0 : Math.max(0, cap) });
  }

  const available = categories.reduce((sum, category) => sum + getAmount(sourceStock, category), 0);
  const shares = fairShares(takers.map((taker) => taker.cap), available);

  const transfers = [];
  let source = sourceStock;
  for (const [index, taker] of takers.entries()) {
    let units = shares[index];
    let stock = taker.stock;
    let cursor = index;
    let misses = 0;
    let changed = false;

    while (units > 0 && misses < categories.length) {
      const category = categories[cursor % categories.length];
      cursor += 1;
      if (getAmount(source, category) <= 0) {
        misses += 1;
        continue;
      }
      misses = 0;
      source = takeCategory(source, category, 1);
      stock = addCategory(stock, category, 1);
      transfers.push({ consumerId: taker.consumerId, category, amount: 1 });
      units -= 1;
      changed = true;
    }

    if (changed) await repository.saveStocks(taker.consumerId, stock);
  }

  return { transfers, sourceStock: source };
}
