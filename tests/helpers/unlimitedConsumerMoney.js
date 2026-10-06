/**
 * A test double for the consumers' money: every consumer can pay for anything, no service bill is unpaid, and purchases are not journaled. Used by the
 * supply tests that are not about money; the money rules have their own tests.
 */
export const unlimitedConsumerMoney = Object.freeze({
  fundsOf: async () => Infinity,
  recordPurchases: async () => {},
  isServiceCutOff: async () => false,
});
