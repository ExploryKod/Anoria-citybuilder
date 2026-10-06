/**
 * The consumers' money, as the supply context needs it: what a house can spend now (its personal account), and the
 * purchases of a delivery, written to the journal by the accounting context.
 * @param {ReturnType<typeof import('./createAccountingContext.js').getOrCreateAccountingContext>} accounting
 */
export function createConsumerMoneyPort(accounting) {
  return {
    fundsOf: (houseId) => accounting.getBuildingAccountBalance(houseId, 'particulier'),
    recordPurchases: (purchases) => accounting.recordConsumerPurchases(purchases),
    isServiceCutOff: (params) => accounting.isServiceCutOff(params),
  };
}
