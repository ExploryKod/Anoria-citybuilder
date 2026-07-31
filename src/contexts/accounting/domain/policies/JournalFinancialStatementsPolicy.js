import {
  isInformativeJournalType,
  isJournalEntryIncomeForMonthlySummary,
} from '../../infrastructure/adapters/persistence/dexie/journalAggregations.js';
import { incomeStatementFromJournalPartition } from './IncomeStatementMappingPolicy.js';
import { balanceSheetLinkedToIncomeStatement } from './BalanceSheetMappingPolicy.js';
import { createFinancialStatementsBundle } from '../read-models/FinancialStatementsBundle.js';

/**
 * @param {Array<object>} entries
 * @param {number} upToTurn
 */
export function filterOperationalEntriesUpToTurn(entries, upToTurn) {
  return entries.filter(
    (entry) => entry.turn <= upToTurn && !isInformativeJournalType(entry.type)
  );
}

/**
 * @param {Array<object>} filteredEntries
 * @param {Array<object>} allEntries
 * @param {(turn: number) => object|null} getTimeInfo
 */
export function partitionJournalEntriesForIncomeStatement(
  filteredEntries,
  allEntries,
  getTimeInfo
) {
  const incomeEntries = [];
  const expenseEntries = [];

  for (const entry of filteredEntries) {
    const isIncome = isJournalEntryIncomeForMonthlySummary(
      entry,
      allEntries,
      getTimeInfo
    );

    if (isIncome) {
      incomeEntries.push(entry);
    } else {
      expenseEntries.push(entry);
    }
  }

  const incomeTotal = incomeEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const expensesTotal = expenseEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  return {
    income: { total: Math.round(incomeTotal), entries: incomeEntries },
    expenses: { total: Math.round(expensesTotal), entries: expenseEntries },
  };
}

/**
 * Treasury cash at turn — prefer informative `balance` snapshot, else null.
 *
 * @param {Array<object>} allEntries
 * @param {number} atTurn
 * @returns {number|null}
 */
export function treasuryCashAtTurnFromJournal(allEntries, atTurn) {
  const balanceEntries = allEntries
    .filter((entry) => entry.type === 'balance' && entry.turn <= atTurn)
    .sort((a, b) => b.turn - a.turn);

  if (balanceEntries.length > 0) {
    return Math.round(balanceEntries[0].amount ?? 0);
  }

  return null;
}

/**
 * Share capital from journal (`capital_funds` at turn 0).
 *
 * @param {Array<object>} allEntries
 * @returns {number}
 */
export function shareCapitalFromJournal(allEntries) {
  let total = 0;
  for (const entry of allEntries) {
    if (entry.type === 'capital_funds' && (entry.turn ?? 0) === 0) {
      total += entry.amount ?? 0;
    }
  }
  return Math.round(total);
}

/**
 * Estimate outstanding loan debt from journal movements up to turn.
 * Approximation: Σ loan_capital − Σ loan_repayment (operational entries).
 *
 * @param {Array<object>} entriesUpToTurn
 * @returns {number}
 */
export function estimatedLoanDebtFromJournal(entriesUpToTurn) {
  let capital = 0;
  let repaid = 0;

  for (const entry of entriesUpToTurn) {
    if (entry.type === 'loan_capital') {
      capital += entry.amount ?? 0;
    } else if (entry.type === 'loan_repayment') {
      repaid += entry.amount ?? 0;
    }
  }

  return Math.max(0, Math.round(capital - repaid));
}

/**
 * Build linked CR + bilan at a turn from journal (primary source).
 *
 * @param {object} params
 * @param {number} params.atTurn
 * @param {Array<object>} params.allEntries
 * @param {(turn: number) => object|null} params.getTimeInfo
 * @param {{ totalValue: number }} params.buildingValuation
 * @param {object|null} [params.enrichment]
 * @param {Array<{ type: string, amount: number }>} [params.currentActiveLoans]
 */
export function financialStatementsBundleFromJournal({
  atTurn,
  allEntries,
  getTimeInfo,
  buildingValuation,
  enrichment = null,
  currentActiveLoans = [],
}) {
  const filtered = filterOperationalEntriesUpToTurn(allEntries, atTurn);
  const partition = partitionJournalEntriesForIncomeStatement(
    filtered,
    allEntries,
    getTimeInfo
  );

  const timeInfo = getTimeInfo(atTurn);
  const fiscalYear = timeInfo?.year ?? null;

  const incomeStatement = incomeStatementFromJournalPartition(
    fiscalYear ?? atTurn,
    partition,
    { cumulativeAtTurn: atTurn }
  );

  const cashFromBalance = treasuryCashAtTurnFromJournal(allEntries, atTurn);
  const shareCapital = shareCapitalFromJournal(allEntries);

  let bankLoans = 0;
  let commercialLoans = 0;

  if (atTurn === (enrichment?.currentTurn ?? atTurn) && currentActiveLoans.length) {
    for (const loan of currentActiveLoans) {
      const amount = Math.round(loan.amount ?? 0);
      if (loan.type === 'bank') bankLoans += amount;
      else if (loan.type === 'commercial') commercialLoans += amount;
    }
  } else if (enrichment?.loanDebt != null) {
    bankLoans = Math.round(enrichment.loanDebt);
  } else {
    const estimated = estimatedLoanDebtFromJournal(filtered);
    bankLoans = estimated;
  }

  const balanceSheet = balanceSheetLinkedToIncomeStatement({
    atTurn,
    incomeStatement,
    cash: cashFromBalance ?? enrichment?.funds ?? 0,
    shareCapital,
    buildingValuation,
    bankLoans,
    commercialLoans,
  });

  return createFinancialStatementsBundle({
    atTurn,
    fiscalYear,
    source: enrichment ? 'journal+cache' : 'journal',
    incomeStatement,
    balanceSheet,
    enrichment,
  });
}

/**
 * Discover turn checkpoints suitable for financial statements history.
 *
 * @param {Array<object>} allEntries
 * @param {number} currentTurn
 * @param {number} [everyNTurns=3]
 * @returns {number[]}
 */
export function discoverFinancialStatementTurns(allEntries, currentTurn, everyNTurns = 3) {
  const turns = new Set();

  for (let turn = everyNTurns; turn <= currentTurn; turn += everyNTurns) {
    turns.add(turn);
  }

  for (const entry of allEntries) {
    if (entry.type === 'balance' && entry.turn > 0) {
      turns.add(entry.turn);
    }
  }

  if (currentTurn > 0) {
    turns.add(currentTurn);
  }

  return [...turns].sort((a, b) => a - b);
}
