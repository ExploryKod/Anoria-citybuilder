/**
 * The treasury is derived from the journal, the single record of money. Every figure the game shows (balance,
 * income, expenses, totals, daily flows, loans) is folded from the journal lines here, in journal order.
 *
 * The rules are the ones the treasury mutations applied before: a credit raises the balance, a debit lowers it.
 * An unknown money type throws: a line the policy does not know must never be silently counted or skipped.
 */
import { isInformativeJournalType } from './JournalEntryClassificationPolicy.js';

const BUILDING_INVESTMENT_MARKERS = ['Building:', 'building'];
const REFUND_INVESTMENT_MARKERS = [...BUILDING_INVESTMENT_MARKERS, 'Refund for'];

/** @param {string} description @param {string[]} markers */
function isBuildingInvestment(description, markers) {
  return markers.some((marker) => description.includes(marker));
}

/** @param {string} type */
function productOf(type, prefix) {
  return type.slice(prefix.length);
}

/**
 * @param {object} entry
 * @returns {'credit' | 'debit' | 'closing' | null} null for a line that moves no money; 'closing' is a year's net.
 */
export function moneyDirectionOf(entry) {
  const { type } = entry;
  if (type === 'year_closing') return 'closing';
  if (isInformativeJournalType(type)) return null;
  if (
    type === 'capital_funds' || type === 'payroll_tax' || type === 'citizen_tax' || type === 'vat' ||
    type === 'loan_capital' || type === 'construction_refund' || type.startsWith('export_')
  ) {
    return 'credit';
  }
  if (
    type === 'maintenance' || type === 'construction' || type === 'salary' ||
    type === 'unemployment_benefit' || type === 'loan_interest' || type === 'loan_repayment' ||
    type === 'exceptional_expenses' || type === 'commercial_route' || type === 'contribution' ||
    type === 'service_subsidy' ||
    type.startsWith('import_')
  ) {
    return 'debit';
  }
  if (type.startsWith('info_')) return null;
  throw new Error(`[treasury] journal line of unknown money type "${type}" (turn ${entry.turn})`);
}

/**
 * @param {Array<object>} entries journal lines, in journal order
 * @param {{ currentTurn: number }} options
 * @returns {{
 *   funds: number, initialFunds: number, income: number, expenses: number, netFlow: number,
 *   dailyIncome: number, dailyExpenses: number, totalTaxes: number, totalSalaries: number,
 *   totalBuildingMaintenance: number, totalInvestments: number, totalUnemploymentBenefits: number,
 *   totalLoanInterest: number, totalLoanInterestExpenses: number, totalLoanRepayments: number,
 *   totalImports: Record<string, number>, totalExports: Record<string, number>,
 * }}
 */
export function deriveTreasuryFigures(entries, { currentTurn }) {
  const figures = {
    funds: 0,
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
    if (direction === 'closing') {
      // A closed year: only its net reaches the funds. Its sub-totals are views, not flows of the treasury.
      figures.funds += entry.closing.net;
      continue;
    }
    const amount = entry.amount;
    const today = entry.turn === currentTurn;
    const { type, description = '' } = entry;

    if (direction === 'credit') {
      figures.funds += amount;
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
      if (type.startsWith('export_')) {
        const product = productOf(type, 'export_');
        figures.totalExports[product] = (figures.totalExports[product] ?? 0) + amount;
        if (today) figures.dailyIncome += amount;
      }
      continue;
    }

    figures.funds -= amount;
    if (type === 'construction') {
      if (isBuildingInvestment(description, BUILDING_INVESTMENT_MARKERS)) {
        figures.totalInvestments += amount;
      } else {
        figures.expenses += amount;
      }
      continue;
    }
    figures.expenses += amount;
    if (today && (type === 'salary' || type === 'unemployment_benefit' || type === 'maintenance' || type.startsWith('import_'))) {
      figures.dailyExpenses += amount;
    }
    if (type === 'maintenance') figures.totalBuildingMaintenance += amount;
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
