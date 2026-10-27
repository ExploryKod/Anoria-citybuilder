/**
 * A test double for the consumers' money: every consumer can pay for anything, no service bill is unpaid, and purchases are not journaled. Used by the
 * supply tests that are not about money; the money rules have their own tests.
 */
export const unlimitedConsumerMoney = Object.freeze({
  fundsOf: async () => Infinity,
  // A company's cash: plenty, and finite (the purchasing power is an amount of euros).
  companyFundsOf: async () => 1e9,
  recordPurchases: async () => {},
  isServiceCutOff: async () => false,
  // A wage of 8 and no upkeep: what a producer's month costs, for the supply tests that are not about prices.
  producerCosting: async () => ({ wageRateOf: () => 8, maintenanceCostOf: () => 0, employerContributionRate: 0 }),
});
