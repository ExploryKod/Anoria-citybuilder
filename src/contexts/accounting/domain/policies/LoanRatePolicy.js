import {
  CAPITAL_WARNING_RATIO,
  COLLATERAL_HAIRCUT,
  COMPANY_CREDIT_MAX_ACCEPTED_RATE,
  COMPANY_CREDIT_SPREAD,
  DEPOSIT_FACILITY_SPREAD,
  HEALTH_RATE_PENALTIES,
  HOUSEHOLD_CASH_BUFFER_MONTHS,
  HOUSEHOLD_SAVINGS_BASE_SHARE,
  HOUSEHOLD_SAVINGS_RATE_SENSITIVITY,
  LOAN_RATE_SPREADS,
  MARGINAL_LENDING_SPREAD,
  MIN_CAPITAL_RATIO,
  SAVINGS_RATE_SPREAD,
} from '../catalogs/BankCatalog.js';

/**
 * The rates of money, all per year (a fraction), all read from the policy rate in force (see BankCatalog.js). One reading for the settlement, the loans
 * panel and the admin panel, so they cannot disagree.
 */

/** @param {number} rate @param {string} what */
function assertRate(rate, what) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) throw new Error(`[loans] ${what} must be a rate of zero or more, got ${rate}`);
}

/**
 * Whether the hamlet's central bank sets its levers (the policy rate, the reserve ratio), and the ones in force. A central bank works when one stands and its posts
 * are all filled (by appointment: a house with fewer residents than posts leaves it closed).
 * @param {object} params
 * @param {number} params.setRate the rate the player set (the hamlet's `policyRate`)
 * @param {number} params.defaultRate the catalog's default, in force while no central bank works
 * @param {number} params.setReserveRatio the reserve ratio the player set (the hamlet's `reserveRatio`)
 * @param {number} params.defaultReserveRatio the catalog's default, in force while no central bank works
 * @param {Array<{ named: number, posts: number }>} params.centralBanks the hamlet's central banks: how many residents are named to how many posts
 * @returns {{ setRate: number, defaultRate: number, setReserveRatio: number, defaultReserveRatio: number, available: boolean, rate: number, reserveRatio: number, reasons: Array<'noCentralBank' | 'notStaffed'> }}
 *   `available`: the player can move the levers; `rate`, `reserveRatio`: the ones in force; `reasons`: why they cannot be moved (empty when they can)
 */
export function policyRateStatusOf({ setRate, defaultRate, setReserveRatio, defaultReserveRatio, centralBanks }) {
  assertRate(setRate, 'the policy rate set');
  assertRate(defaultRate, 'the default policy rate');
  assertRatio(setReserveRatio, 'the reserve ratio set');
  assertRatio(defaultReserveRatio, 'the default reserve ratio');
  const reasons = [];
  if (centralBanks.length === 0) reasons.push('noCentralBank');
  else if (!centralBanks.some(({ named, posts }) => named >= posts)) reasons.push('notStaffed');
  const available = reasons.length === 0;
  return {
    setRate, defaultRate, setReserveRatio, defaultReserveRatio, available, reasons,
    rate: available ? setRate : defaultRate,
    reserveRatio: available ? setReserveRatio : defaultReserveRatio,
  };
}

/** @param {number} ratio @param {string} what */
function assertRatio(ratio, what) {
  if (typeof ratio !== 'number' || !(ratio >= 0 && ratio <= 1)) throw new Error(`[bank] ${what} must be a share between 0 and 1, got ${ratio}`);
}

/**
 * The cash the bank must keep: the reserve ratio in force of what its depositors hold there (165).
 * @param {{ deposits: number, reserveRatio: number }} params `deposits` in centimes
 * @returns {number} centimes
 */
export function requiredReserveOf({ deposits, reserveRatio }) {
  assertRatio(reserveRatio, 'the reserve ratio');
  if (!Number.isInteger(deposits)) throw new Error(`[bank] the deposits must be a whole number of centimes, got ${deposits}`);
  return Math.round(Math.max(0, deposits) * reserveRatio);
}

/** @param {number} policyRate the policy rate in force @returns {number} what the bank charges a company a year on its credit */
export function companyCreditRateOf(policyRate) {
  assertRate(policyRate, 'the policy rate');
  return policyRate + COMPANY_CREDIT_SPREAD;
}

/**
 * How much of its credit ceiling a company is willing to take at a credit rate: all of it when credit is free, less as it gets dearer, none at the rate the catalog
 * says no company accepts.
 * @param {number} creditRate the yearly rate of the bank's credit
 * @returns {number} a share between 0 and 1
 */
export function companyCreditAppetiteOf(creditRate) {
  assertRate(creditRate, 'the credit rate');
  return Math.max(0, 1 - creditRate / COMPANY_CREDIT_MAX_ACCEPTED_RATE);
}

/**
 * The share of what a household holds above its cash buffer that it puts at the bank: the base share, more as the savings pay more, never above all of it.
 * @param {number} savingsRate per year, a fraction
 * @returns {number} a share between 0 and 1
 */
export function householdSavingShareOf(savingsRate) {
  assertRate(savingsRate, 'the savings rate');
  return Math.min(1, HOUSEHOLD_SAVINGS_BASE_SHARE + HOUSEHOLD_SAVINGS_RATE_SENSITIVITY * savingsRate);
}

/**
 * What a household does with its money this month: it keeps a cash buffer of what it lives on (the larger of its income of the month and its spending of the month
 * before), saves a share of what it holds above it (more when the savings pay more), and draws on its savings when it holds less. Whole euros, in centimes.
 * @param {{ cash: number, income: number, spending: number, savings: number, savingsRate: number }} household centimes; `savingsRate` per year, a fraction
 * @returns {{ deposit: number, withdraw: number }} one of them is 0
 */
export function householdSavingsMoveOf({ cash, income, spending, savings, savingsRate }) {
  assertRate(savingsRate, 'the savings rate');
  for (const [name, value] of Object.entries({ cash, income, spending, savings })) {
    if (!Number.isInteger(value)) throw new Error(`[savings] ${name} must be a whole number of centimes, got ${value}`);
  }
  const wholeEuros = (centimes) => Math.floor(Math.max(0, centimes) / 100) * 100;
  const buffer = Math.round(Math.max(income, spending, 0) * HOUSEHOLD_CASH_BUFFER_MONTHS);
  if (cash > buffer) return { deposit: wholeEuros((cash - buffer) * householdSavingShareOf(savingsRate)), withdraw: 0 };
  // Short of its buffer: it takes back what it lacks, in whole euros, as far as its savings go.
  const lacking = Math.ceil((buffer - cash) / 100) * 100;
  return { deposit: 0, withdraw: Math.min(wholeEuros(savings), lacking) };
}

/**
 * A month of a loan that pays its interest as far as the cash goes and adds the rest to the debt (no money moves for that part): the bank's refinancing, a
 * company's credit. All in centimes.
 * @param {{ outstanding: number, yearlyRate: number, cash: number, monthsPerYear: number }} params
 * @returns {{ interestPaid: number, interestCapitalised: number }}
 */
export function monthInterestOf({ outstanding, yearlyRate, cash, monthsPerYear }) {
  assertRate(yearlyRate, 'the yearly rate');
  if (!Number.isInteger(outstanding) || !Number.isInteger(cash)) throw new Error(`[loans] the outstanding and the cash must be whole numbers of centimes, got ${outstanding} and ${cash}`);
  if (outstanding <= 0) return { interestPaid: 0, interestCapitalised: 0 };
  const interest = Math.round((outstanding * yearlyRate) / monthsPerYear);
  const interestPaid = Math.min(Math.max(0, cash), interest);
  return { interestPaid, interestCapitalised: interest - interestPaid };
}

/** @param {number} policyRate the policy rate in force @returns {number} what the bank pays a year on savings */
export function savingsRateOf(policyRate) {
  assertRate(policyRate, 'the policy rate');
  return Math.max(0, policyRate - SAVINGS_RATE_SPREAD);
}

/**
 * @param {{ loanType: 'bank' | 'commercial', financialHealthStatus: 'excellent' | 'healthy' | 'warning' | 'deficit' | 'critical', policyRate: number }} params
 * @returns {number} the loan's rate, per year
 */
export function computeLoanRate({ loanType, financialHealthStatus, policyRate }) {
  if (!Object.hasOwn(LOAN_RATE_SPREADS, loanType)) {
    throw new Error(`[loans] "${loanType}" is not a type of loan (${Object.keys(LOAN_RATE_SPREADS).join(', ')})`);
  }
  if (!Object.hasOwn(HEALTH_RATE_PENALTIES, financialHealthStatus)) {
    throw new Error(`[loans] "${financialHealthStatus}" is not a financial health status (${Object.keys(HEALTH_RATE_PENALTIES).join(', ')})`);
  }
  assertRate(policyRate, 'the policy rate');
  return policyRate + LOAN_RATE_SPREADS[loanType] + HEALTH_RATE_PENALTIES[financialHealthStatus][loanType];
}

/**
 * @param {'excellent' | 'healthy' | 'warning' | 'deficit' | 'critical'} financialHealthStatus
 * @param {number} policyRate the policy rate in force
 * @returns {{ bank: number, commercial: number }} each type's rate, per year
 */
export function computeLoanRatesByType(financialHealthStatus, policyRate) {
  return {
    bank: computeLoanRate({ loanType: 'bank', financialHealthStatus, policyRate }),
    commercial: computeLoanRate({ loanType: 'commercial', financialHealthStatus, policyRate }),
  };
}

/**
 * A loan's whole interest: the yearly rate on the principal, for the share of a year the loan lasts (simple interest, paid with each installment).
 * @param {{ amount: number, yearlyRate: number, durationTurns: number, turnsPerYear: number }} params
 * @returns {number} whole euros
 */
export function computeLoanInterestAmount({ amount, yearlyRate, durationTurns, turnsPerYear }) {
  assertRate(yearlyRate, 'the yearly rate');
  if (!Number.isInteger(durationTurns) || durationTurns <= 0) throw new Error(`[loans] a loan lasts a whole number of turns, got ${durationTurns}`);
  if (!Number.isInteger(turnsPerYear) || turnsPerYear <= 0) throw new Error(`[loans] a year lasts a whole number of turns, got ${turnsPerYear}`);
  return Math.round(amount * yearlyRate * (durationTurns / turnsPerYear));
}

/**
 * The corridor of the central bank's rates around the policy rate the player sets: the deposit facility below (what it pays on the reserves above the reserve due, never
 * under nothing), the main refinancing at the policy rate, the marginal lending above (what a bank pays to borrow reserves at once). All per year, a fraction.
 * @param {number} policyRate the policy rate in force
 * @returns {{ deposit: number, main: number, marginal: number }}
 */
export function corridorOf(policyRate) {
  assertRate(policyRate, 'the policy rate');
  return { deposit: Math.max(0, policyRate - DEPOSIT_FACILITY_SPREAD), main: policyRate, marginal: policyRate + MARGINAL_LENDING_SPREAD };
}

/**
 * What the central bank pays a bank in a month on the reserves it holds above the reserve due (the deposit facility), centimes.
 * @param {{ reserves: number, requiredReserve: number, depositRate: number, monthsPerYear: number }} params centimes, `depositRate` per year
 * @returns {number} centimes
 */
export function reservesInterestOf({ reserves, requiredReserve, depositRate, monthsPerYear }) {
  assertRate(depositRate, 'the deposit facility rate');
  if (!Number.isInteger(reserves) || !Number.isInteger(requiredReserve)) throw new Error(`[bank] the reserves must be whole centimes, got ${reserves} and ${requiredReserve}`);
  return Math.round((Math.max(0, reserves - requiredReserve) * depositRate) / monthsPerYear);
}

/**
 * What a bank may owe the central bank in all: its loans (what it can pledge), less the haircut, less what it already owes. The central bank lends only against collateral.
 * @param {{ loans: number, owed: number, newLending?: number }} params centimes: `loans` the bank's loans now, `owed` what it owes the central bank, `newLending` what it is about
 *   to lend (which will be collateral too)
 * @returns {number} centimes, never negative
 */
export function collateralCapacityOf({ loans, owed, newLending = 0 }) {
  for (const [name, value] of Object.entries({ loans, owed, newLending })) {
    if (!Number.isInteger(value)) throw new Error(`[bank] ${name} must be a whole number of centimes, got ${value}`);
  }
  return Math.max(0, Math.round((Math.max(0, loans) + newLending) * (1 - COLLATERAL_HAIRCUT)) - owed);
}

/**
 * A month of the bank's debt to the central bank, in its two facilities: the marginal lending (dearer, borrowed at once to lend) and the main refinancing (the reserve upkeep).
 * Each pays its interest as far as the bank's reserves go, the marginal first (the rest is added to its debt), then they are repaid out of the reserves above the reserve due,
 * the dearest first. All in centimes.
 * @param {{ main: number, marginal: number, rates: { main: number, marginal: number }, reserves: number, deposits: number, reserveRatio: number, monthsPerYear: number }} params
 *   `main`, `marginal`: what the bank owes in each; `reserves`: its reserves now; `deposits`: what it owes its customers; `reserveRatio`: the ratio in force
 * @returns {{ main: { interestPaid: number, interestCapitalised: number, repayment: number }, marginal: { interestPaid: number, interestCapitalised: number, repayment: number } }}
 */
export function refinancingMonthOf({ main, marginal, rates, reserves, deposits, reserveRatio, monthsPerYear }) {
  const marginalInterest = monthInterestOf({ outstanding: marginal, yearlyRate: rates.marginal, cash: reserves, monthsPerYear });
  const afterMarginal = reserves - marginalInterest.interestPaid;
  const mainInterest = monthInterestOf({ outstanding: main, yearlyRate: rates.main, cash: afterMarginal, monthsPerYear });
  const free = Math.max(0, afterMarginal - mainInterest.interestPaid - requiredReserveOf({ deposits, reserveRatio }));
  const marginalRepayment = Math.min(marginal + marginalInterest.interestCapitalised, free);
  const mainRepayment = Math.min(main + mainInterest.interestCapitalised, free - marginalRepayment);
  return {
    marginal: { ...marginalInterest, repayment: marginalRepayment },
    main: { ...mainInterest, repayment: mainRepayment },
  };
}

/**
 * What a loan's installment of one turn is: the same every turn, its interest a share of the loan's whole interest. The loans panel, its schedule and the
 * budget all read it here, so what is shown is what is paid.
 * @param {{ total: number, interest: number, duration: number }} loan
 * @returns {{ payment: number, interest: number, principal: number }} whole euros
 */
export function loanInstallmentOf(loan) {
  if (!Number.isInteger(loan.duration) || loan.duration <= 0) throw new Error(`[loans] loan ${loan.id} has no duration in turns (${loan.duration})`);
  if (typeof loan.interest !== 'number' || typeof loan.total !== 'number') throw new Error(`[loans] loan ${loan.id} has no interest or total written when it was contracted`);
  const payment = Math.round(loan.total / loan.duration);
  const interest = Math.round(loan.interest / loan.duration);
  return { payment, interest, principal: Math.max(0, payment - interest) };
}

/**
 * Where the bank stands with its supervisor: its equity against its loans (the claims it can lose on). `insolvent`: equity below nothing; `frozen`: under the minimum ratio,
 * no new lending; `warning`: under the warning ratio; `sound` otherwise (a bank with no loans has no ratio and is sound while its equity is not negative).
 * @param {{ equity: number, loans: number }} params the same unit (euros or centimes)
 * @returns {{ status: 'sound' | 'warning' | 'frozen' | 'insolvent', ratio: number | null }}
 */
export function capitalStatusOf({ equity, loans }) {
  if (!Number.isFinite(equity) || !Number.isFinite(loans)) throw new Error(`[bank] the capital status needs an equity and loans, got ${equity} and ${loans}`);
  const ratio = loans > 0 ? equity / loans : null;
  if (equity < 0) return { status: 'insolvent', ratio };
  if (ratio === null) return { status: 'sound', ratio };
  if (ratio < MIN_CAPITAL_RATIO) return { status: 'frozen', ratio };
  if (ratio < CAPITAL_WARNING_RATIO) return { status: 'warning', ratio };
  return { status: 'sound', ratio };
}
