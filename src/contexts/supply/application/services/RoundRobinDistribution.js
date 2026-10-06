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
 * Round-robin hand-out of one source's units to its consumers. Each pass, every consumer may take 1 unit per category the
 * source still holds, up to its cap (what it still needs).
 *
 * `money` makes the consumers pay: `fundsOf(consumerId)` is what the consumer can spend now, and `priceOf(category)` the
 * price of one unit. A unit is taken only when the consumer can pay it, so a consumer may get fewer units than it needs
 * (the rest is unpaid). Without `money` nothing is charged: a hub supplies a distributor, it does not pay for it.
 *
 * Every consumer is reported in `unmet` on every pass, with what it is still missing and why: `unpaidUnits` when its money
 * blocked a unit the source still held, `shortageUnits` when the source ran out.
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
 * @param {{ fundsOf: (consumerId: string) => Promise<number>, priceOf: (category: string) => number } | null} [params.money]
 * @returns {Promise<{
 *   transfers: Array<{ consumerId: string, category: string, amount: number }>,
 *   sourceStock: object,
 *   unmet: Array<{ consumerId: string, cap: number, taken: number, unpaidUnits: number, shortageUnits: number }>,
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
  money = null,
}) {
  const takers = [];
  for (const consumerId of consumerIds) {
    const consumer = await repository.findById(consumerId);
    if (!consumer || !isEligible(consumer)) continue;
    const cap = getCap(consumer);
    takers.push({
      consumerId,
      stock: createStock(consumer.stocks),
      cap: Number.isNaN(cap) ? 0 : Math.max(0, cap),
      funds: money ? await money.fundsOf(consumerId) : Infinity,
    });
  }

  const available = categories.reduce((sum, category) => sum + getAmount(sourceStock, category), 0);
  const shares = fairShares(takers.map((taker) => taker.cap), available);

  const transfers = [];
  const unmet = [];
  let source = sourceStock;
  for (const [index, taker] of takers.entries()) {
    let units = shares[index];
    let stock = taker.stock;
    let funds = taker.funds;
    let cursor = index;
    let misses = 0;
    let taken = 0;
    let blockedByMoney = false;
    let changed = false;

    while (units > 0 && misses < categories.length) {
      const category = categories[cursor % categories.length];
      cursor += 1;
      if (getAmount(source, category) <= 0) {
        misses += 1;
        continue;
      }
      const price = money ? money.priceOf(category) : 0;
      if (!Number.isFinite(price) || price < 0) throw new Error(`[supply] "${category}" has no price to be paid: got ${price}`);
      if (funds < price) {
        blockedByMoney = true;
        misses += 1;
        continue;
      }
      misses = 0;
      source = takeCategory(source, category, 1);
      stock = addCategory(stock, category, 1);
      funds -= price;
      transfers.push({ consumerId: taker.consumerId, category, amount: 1 });
      units -= 1;
      taken += 1;
      changed = true;
    }

    if (changed) await repository.saveStocks(taker.consumerId, stock);
    // Every taker is reported on every pass (missing 0 when served), so the last pass of a day is its final state.
    const missing = Math.max(0, taker.cap - taken);
    unmet.push({
      consumerId: taker.consumerId,
      cap: taker.cap,
      taken,
      unpaidUnits: blockedByMoney ? missing : 0,
      shortageUnits: blockedByMoney ? 0 : missing,
    });
  }

  return { transfers, sourceStock: source, unmet };
}
