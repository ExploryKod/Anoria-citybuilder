/**
 * The bank's own declared rates — separate from ProducerChargeCatalog (a lucrative building's generic charges)
 * because these are specific to the deposit relationship between a house and its bank, not to any producer.
 *
 * - `DEPOSIT_INTEREST_RATE`: the interest a bank pays, per year, on what a house has deposited (a fraction of the
 *   balance), credited once when the fiscal year closes (see SettleBankDepositInterest.js). A real expense for the
 *   bank, in its compte de résultat (financial charge), so it reduces the result its corporate tax is based on, not
 *   just what sits in its account. The game's economy scale: the equivalent of 1 % a month, paid yearly.
 */
export const DEPOSIT_INTEREST_RATE = 0.12;
