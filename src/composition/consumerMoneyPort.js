/**
 * What the supply context needs from the accounting: the consumers' money (what a house can spend now, from its personal account, and the
 * purchases of a delivery, written to the journal) and what a producer's month costs apart from its inputs (the labour market's wages and the
 * buildings' upkeep), which its sale price is built on.
 * @param {ReturnType<typeof import('./createAccountingContext.js').getOrCreateAccountingContext>} accounting
 */
export function createConsumerMoneyPort(accounting) {
  return {
    fundsOf: (houseId) => accounting.getBuildingAccountBalance(houseId, 'particulier'),
    recordPurchases: (purchases) => accounting.recordConsumerPurchases(purchases),
    isServiceCutOff: (params) => accounting.isServiceCutOff(params),
    producerCosting: () => accounting.getProducerCosting(),
  };
}
