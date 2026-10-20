/**
 * The treasury is derived from the journal, the single record of money. The balance is the balance of the cash account (512) in the
 * fold of the journal's legs (LegsFold). The other figures the game shows (income, expenses, totals, daily flows, loans) are folded from
 * the journal lines here, in journal order: they say what the money was for, which the cash account does not.
 *
 * An unknown money type throws: a line the policy does not know must never be silently counted or skipped.
 */
import { isEcriture } from './EntryLegsPolicy.js';

/** The cash account of the chart of accounts. */
const CASH = '512';

/** The words a construction line's description carries when it is a building the city pays for (see PlaceBuildingWithPayment), and what its refund's carries. */
export const BUILDING_INVESTMENT_MARKERS = ['Building:', 'building'];
export const REFUND_INVESTMENT_MARKERS = [...BUILDING_INVESTMENT_MARKERS, 'Refund for'];

/** @param {string} description @param {string[]} markers */
export function isBuildingInvestment(description, markers) {
  return markers.some((marker) => description.includes(marker));
}

/** @param {string} type */
function productOf(type, prefix) {
  return type.slice(prefix.length);
}

/**
 * Which way the money of a line went, read from the legs the journal booked: the cash account (512) debited is money in, credited is money out. A line with no
 * leg on the cash (an opération diverse, an informative line) moves no money.
 * @param {object} entry
 * @returns {'credit' | 'debit' | 'closing' | null} null for a line that moves no money; 'closing' is a year's net.
 */
export function moneyDirectionOf(entry) {
  if (entry.type === 'year_closing') return 'closing';
  if (!isEcriture(entry.type)) return null;
  if (!entry.legs) throw new Error(`[treasury] journal line ${entry.type} (turn ${entry.turn}) carries no legs: it was never booked`);
  const net = entry.legs.filter((leg) => leg.account === CASH).reduce((sum, leg) => sum + leg.debit - leg.credit, 0);
  if (net > 0) return 'credit';
  if (net < 0) return 'debit';
  return null;
}

/**
 * @param {Array<object>} entries journal lines, in journal order
 * @param {{ currentTurn: number }} options
 * @returns {{
 *   initialFunds: number, income: number, expenses: number, netFlow: number,
 *   dailyIncome: number, dailyExpenses: number, totalTaxes: number, totalSalaries: number,
 *   totalBuildingMaintenance: number, totalInvestments: number, totalUnemploymentBenefits: number,
 *   totalLoanInterest: number, totalLoanInterestExpenses: number, totalLoanRepayments: number,
 *   totalImports: Record<string, number>, totalExports: Record<string, number>,
 * }}
 */
export function deriveTreasuryFigures(entries, { currentTurn }) {
  const figures = {
    initialFunds: 0,
    income: 0,
    expenses: 0,
    netFlow: 0,
    dailyIncome: 0,
    dailyExpenses: 0,
    totalTaxes: 0,
    totalSalaries: 0,
    totalBuildingMaintenance: 0,
    totalInvestments: 0,
    totalUnemploymentBenefits: 0,
    totalLoanInterest: 0,
    totalLoanInterestExpenses: 0,
    totalLoanRepayments: 0,
    totalImports: {},
    totalExports: {},
  };

  for (const entry of entries) {
    const direction = moneyDirectionOf(entry);
    if (!direction) continue;
    // A closed year carries its balances (the cash among them, read from the fold): its sub-totals are views, not flows of the treasury.
    if (direction === 'closing') continue;
    const amount = entry.amount;
    const today = entry.turn === currentTurn;
    const { type, description = '' } = entry;

    if (direction === 'credit') {
      if (type === 'construction_refund') {
        if (isBuildingInvestment(description, REFUND_INVESTMENT_MARKERS)) {
          figures.totalInvestments = Math.max(0, figures.totalInvestments - amount);
        } else {
          figures.expenses = Math.max(0, figures.expenses - amount);
        }
        continue;
      }
      figures.income += amount;
      if (type === 'capital_funds') figures.initialFunds += amount;
      if (type === 'citizen_tax') {
        figures.totalTaxes += amount;
        if (today) figures.dailyIncome += amount;
      }
      if (type.startsWith('customs_import_') && today) figures.dailyIncome += amount;
      if (type.startsWith('export_')) {
        const product = productOf(type, 'export_');
        figures.totalExports[product] = (figures.totalExports[product] ?? 0) + amount;
        if (today) figures.dailyIncome += amount;
      }
      continue;
    }

    // The capital the city pays a company is an investment of the city, like a construction: it is not a running expense.
    if (type === 'company_capital_paid') {
      figures.totalInvestments += amount;
      continue;
    }
    if (type === 'construction') {
      if (isBuildingInvestment(description, BUILDING_INVESTMENT_MARKERS)) {
        figures.totalInvestments += amount;
      } else {
        figures.expenses += amount;
      }
      continue;
    }
    figures.expenses += amount;
    // The city's upkeep of the buildings it does not run itself is the rent it pays their owner.
    if (today && (type === 'salary' || type === 'unemployment_benefit' || type === 'maintenance' || type === 'premises_rent_paid' || type.startsWith('import_') || type.startsWith('freight_') || type.startsWith('duty_paid_'))) {
      figures.dailyExpenses += amount;
    }
    if (type === 'maintenance' || type === 'premises_rent_paid') figures.totalBuildingMaintenance += amount;
    if (type === 'salary') figures.totalSalaries += amount;
    if (type === 'unemployment_benefit') figures.totalUnemploymentBenefits += amount;
    if (type === 'loan_interest') {
      figures.totalLoanInterest += amount;
      figures.totalLoanInterestExpenses += amount;
    }
    if (type === 'loan_repayment') figures.totalLoanRepayments += amount;
    if (type.startsWith('import_')) {
      const product = productOf(type, 'import_');
      figures.totalImports[product] = (figures.totalImports[product] ?? 0) + amount;
    }
  }

  figures.netFlow = figures.income - figures.expenses;
  return figures;
}

/**
 * The citizen-tax state the treasury used to keep on its row: the last collected year (a year is taxed once) and the
 * breakdown of the last collection. Both are folded from the citizen_tax lines.
 *
 * @param {Array<object>} entries journal lines, in journal order
 * @returns {{ lastTaxYear: number|null, taxBreakdown: object|null }}
 */
export function deriveCitizenTaxState(entries) {
  let lastTaxYear = null;
  let taxBreakdown = null;
  for (const entry of entries) {
    if (entry.type !== 'citizen_tax') continue;
    if (typeof entry.taxYear !== 'number') {
      throw new Error(`[treasury] citizen_tax line of turn ${entry.turn} has no tax year`);
    }
    lastTaxYear = entry.taxYear;
    taxBreakdown = entry.taxBreakdown ?? null;
  }
  return { lastTaxYear, taxBreakdown };
}

/** Lines of a loan that mean "an installment was due this turn", paid or not. */
const INSTALLMENT_TYPES = new Set(['loan_repayment', 'loan_interest', 'info_loan_repayment', 'info_loan_interest']);

/**
 * Loan portfolio, folded from the journal. A contract is a `loan_capital` line carrying its `loanId` and its `loan`
 * terms (`remainingTurns`). Its principal falls with each `loan_repayment` of that loan. Its schedule falls by one for
 * each turn that had an installment of that loan, paid or unpaid. A loan leaves the portfolio when its schedule or its
 * principal reaches zero.
 *
 * @param {Array<object>} entries journal lines, in journal order
 * @returns {{ loans: Array<object>, loanDebt: number }} each loan is its contract, with the derived amount and schedule
 */
export function deriveLoanPortfolio(entries) {
  const contracts = new Map();
  for (const entry of entries) {
    if (entry.type !== 'loan_capital') continue;
    if (!entry.loanId || !entry.loan) {
      throw new Error(`[treasury] loan_capital line of turn ${entry.turn} has no loan contract`);
    }
    contracts.set(entry.loanId, {
      contract: entry.loan,
      amount: entry.amount,
      remainingTurns: entry.loan.remainingTurns,
      installmentTurns: new Set(),
    });
  }

  for (const entry of entries) {
    if (!INSTALLMENT_TYPES.has(entry.type)) continue;
    const contract = contracts.get(entry.loanId);
    if (!contract) {
      throw new Error(`[treasury] loan line "${entry.type}" of turn ${entry.turn} names an unknown loan "${entry.loanId}"`);
    }
    if (entry.type === 'loan_repayment') contract.amount -= entry.amount;
    contract.installmentTurns.add(entry.turn);
  }

  const loans = [];
  for (const contract of contracts.values()) {
    const remainingTurns = contract.remainingTurns - contract.installmentTurns.size;
    const amount = Math.max(0, contract.amount);
    if (remainingTurns > 0 && amount > 0) {
      loans.push({ ...contract.contract, amount, remainingTurns });
    }
  }
  return {
    loans,
    loanDebt: loans.reduce((sum, loan) => sum + loan.amount, 0),
  };
}
