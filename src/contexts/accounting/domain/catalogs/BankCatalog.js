/**
 * The bank's rates, all per year (a fraction), all read from the policy rate (taux directeur) the central bank sets — separate from ProducerChargeCatalog
 * (a lucrative building's generic charges) because they are the money's own prices, not a producer's charges. See LoanRatePolicy.js for how they combine.
 *
 * The central bank refinances the bank at the policy rate, by creating the money (BankRefinancing.js): the bank borrows exactly what it lacks to pay a
 * depositor's withdrawal or to lend the city, and repays out of its surplus.
 *
 * The policy rate and the reserve ratio are rates of the hamlet (`policyRate`, `reserveRatio`, FiscalRateCatalog.js): the player moves them only while a central
 * bank works (one stands and its posts are filled by appointment); otherwise the catalog's defaults are in force, as a tax nobody collects is in force at 0 %.
 */

/** The skill the central bank's posts ask (buildingEconomy.js): the building that asks it is the central bank, read from the catalog, never by its id. */
export const CENTRAL_BANK_SKILL = 'banque-centrale';

/**
 * What the bank pays on savings, below the policy rate: it lends its depositors' money at more than the central bank's rate and pays them less. The interest
 * is credited once a year (SettleBankDepositInterest.js), a real charge of the bank (6615). Never below 0: a policy rate under the spread pays no interest.
 */
export const SAVINGS_RATE_SPREAD = 0.02;

/**
 * The corridor of the central bank's rates, around the policy rate the player sets (see LoanRatePolicy.corridorOf):
 *   - the **deposit facility** rate, below it: what the central bank pays a bank each year on the reserves it holds above the reserve due (the floor of the market);
 *   - the policy rate itself, the **main refinancing** rate: what a bank pays for the reserves it borrows to keep its reserve due at the month's close;
 *   - the **marginal lending** rate, above it: what a bank pays for the reserves it borrows at once, to lend while it is short (the ceiling).
 * Spreads in points of a yearly rate. The deposit rate never goes below nothing.
 */
export const DEPOSIT_FACILITY_SPREAD = 0.02;
export const MARGINAL_LENDING_SPREAD = 0.03;

/**
 * The central bank lends only against collateral: the bank's own loans (to the State and to the companies), each euro of them counting for this share less, the haircut
 * (the central bank keeps a margin against a loan that is not repaid). A bank owes the central bank at most that value.
 */
export const COLLATERAL_HAIRCUT = 0.1;

/**
 * The deposit guarantee (docs/gameplay/PLAN_BANK_MONEY.md): when a bank is liquidated, the city makes each saver whole only up to `DEPOSIT_GUARANTEE_CAP` (euros, the savers'
 * total at that bank); what a saver held beyond it, and the bank cannot give back, is lost. It is funded by the banks: each month the bank pays the city a premium, this
 * share per year of the savings it holds (`DEPOSIT_GUARANTEE_PREMIUM_RATE`).
 */
export const DEPOSIT_GUARANTEE_CAP = 500;
export const DEPOSIT_GUARANTEE_PREMIUM_RATE = 0.003;

/**
 * The supervision of the bank's capital (LoanRatePolicy.capitalStatusOf): its equity as a share of its loans. Under `CAPITAL_WARNING_RATIO` the player is warned each month;
 * under `MIN_CAPITAL_RATIO` the supervisor freezes its lending (no new loan to the State, no new credit to a company) until it is recapitalised or its loans shrink, well
 * before its equity falls below nothing (insolvency).
 */
export const MIN_CAPITAL_RATIO = 0.08;
export const CAPITAL_WARNING_RATIO = 0.12;

/**
 * The bank's credit to the companies (BankCompanyCredit.js): a company short of cash for its month's charges borrows the shortfall, at the policy rate plus this
 * spread, up to a ceiling of this many months of its charges at full staffing (the same month its founding capital is sized on). It repays out of its monthly profit.
 */
export const COMPANY_CREDIT_SPREAD = 0.08;
export const COMPANY_CREDIT_CEILING_MONTHS = 3;

/**
 * A company borrows less when credit is dear: the ceiling above shrinks in proportion as the credit rate rises, and at this yearly rate it borrows nothing at all
 * (it prefers to fall behind on its charges than to pay that much). At the default policy rate (14 %, a credit at 22 %) it takes a little over half the ceiling.
 */
export const COMPANY_CREDIT_MAX_ACCEPTED_RATE = 0.5;

/**
 * What a household does with its money each month (SettleHouseholdSavings.js): it keeps a cash buffer of this many months of what it lives on (the larger of its
 * income of the month and its spending of the month before), saves at the bank a share of what it holds above it, and draws on its savings when it holds less.
 * The share it saves rises with the savings rate: the base share, plus this many times the rate (20 % + 2 × 12 % = 44 % at the default rate), never above all of it.
 */
export const HOUSEHOLD_CASH_BUFFER_MONTHS = 1;
export const HOUSEHOLD_SAVINGS_BASE_SHARE = 0.2;
export const HOUSEHOLD_SAVINGS_RATE_SENSITIVITY = 2;

/** What the bank adds to the policy rate on what it lends the city, per type of loan: the commercial loan is longer and larger, so dearer. */
export const LOAN_RATE_SPREADS = Object.freeze({
  bank: 0.06,
  commercial: 0.08,
  // A loan from a partner city (ExternalLenderCatalog.js, which adds its own spread): foreign money, dearer than the bank's.
  external: 0.07,
});

/**
 * What the city's financial health adds to a loan's rate, per year, per status (FinancialHealthPolicy.js) and per type of loan: a city that
 * borrows while it loses money is a riskier debtor. A status not listed here throws.
 */
export const HEALTH_RATE_PENALTIES = Object.freeze({
  excellent: Object.freeze({ bank: 0, commercial: 0, external: 0 }),
  healthy: Object.freeze({ bank: 0, commercial: 0, external: 0 }),
  warning: Object.freeze({ bank: 0.04, commercial: 0.05, external: 0.04 }),
  deficit: Object.freeze({ bank: 0.04, commercial: 0.05, external: 0.04 }),
  critical: Object.freeze({ bank: 0.10, commercial: 0.12, external: 0.10 }),
});
