/**
 * The bank's own declared rates — separate from ProducerChargeCatalog (a lucrative building's generic charges)
 * because these are specific to the deposit relationship between a house and its bank, not to any producer.
 *
 * - `DEPOSIT_INTEREST_RATE`: the interest a bank pays, per month, on what a house has deposited (a fraction of
 *   the balance). A real expense for the bank (see SettleBankDepositInterest.js), folded into its own
 *   corporate-tax profit via `buildingChargeLines`'s `otherExpensesHT` (ProducerChargePolicy.js) — it reduces
 *   what the bank owes the city, not just what sits in its account.
 */
export const DEPOSIT_INTEREST_RATE = 0.01;
