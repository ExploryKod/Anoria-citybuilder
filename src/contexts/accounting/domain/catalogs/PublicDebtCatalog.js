/**
 * How much a State can owe (docs/gameplay/PLAN_BANK_MONEY.md). Lenders lend to a State as long as its gross debt (HamletEconomyPolicy.publicDebtOf: loans, overdraft,
 * unpaid suppliers) stays reasonable against what its economy produces: the ceiling is `DEBT_CEILING_SHARE_OF_GDP` of its domestic product over the last twelve months
 * (60 % is the Maastricht reference). A young State, whose product is small or not measured yet, would be shut out at once, so the ceiling never falls below
 * `MINIMUM_DEBT_CEILING` (euros): the credit lenders grant a new State on trust.
 */
export const DEBT_CEILING_SHARE_OF_GDP = 0.6;
export const MINIMUM_DEBT_CEILING = 5000;
