/**
 * Generic round-robin distribution: a source stock pushes 1 unit of each
 * still-available category to each eligible consumer in turn, cycling until a
 * full pass moves nothing. Resource-agnostic — callers pass the stock
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
}) {
  const transfers = [];
  let source = sourceStock;

  const maxIterations = Math.max(
    ...categories.map((category) => getAmount(source, category)),
    1,
  );

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let movedThisRound = false;

    for (const consumerId of consumerIds) {
      const stillAvailable = categories.some((category) => getAmount(source, category) > 0);
      if (!stillAvailable) break;

      const consumer = await repository.findById(consumerId);
      if (!consumer) continue;
      if (!isEligible(consumer)) continue;

      let consumerStock = createStock(consumer.stocks);
      let changed = false;

      for (const category of categories) {
        if (getAmount(source, category) <= 0) continue;
        source = takeCategory(source, category, 1);
        consumerStock = addCategory(consumerStock, category, 1);
        transfers.push({ consumerId, category, amount: 1 });
        changed = true;
        movedThisRound = true;
      }

      if (changed) {
        await repository.saveStocks(consumerId, consumerStock);
      }
    }

    if (!movedThisRound) break;
  }

  return { transfers, sourceStock: source };
}
