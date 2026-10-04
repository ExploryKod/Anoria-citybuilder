/**
 * Year closing: when a full year is purged from the journal, its money lines are replaced by one `year_closing` line
 * per hamlet and year. The line keeps what the purge would otherwise lose:
 *   - the net flow of the year, which is the treasury's effect of the year (the balance stays exact);
 *   - the year's totals per journal type, i.e. the sub-totals the yearly summary and the city ledger show.
 *
 * Loan lines are kept as they are: a loan whose schedule runs past the purge still needs its contract and installments.
 */
import { moneyDirectionOf } from './TreasuryFromJournalPolicy.js';

export const YEAR_CLOSING_TYPE = 'year_closing';

/** Loan lines survive a purge: a contract and its schedule are not a year's total. */
const KEPT_LOAN_TYPES = new Set([
  'loan_capital',
  'loan_repayment',
  'loan_interest',
  'info_loan_interest',
  'info_loan_repayment',
]);

/**
 * @param {object} entry
 * @returns {boolean} true when the line is folded into its year's closing.
 */
export function isFoldedIntoClosing(entry) {
  if (entry.type === YEAR_CLOSING_TYPE || KEPT_LOAN_TYPES.has(entry.type)) return false;
  return true;
}

/**
 * @param {object} params
 * @param {number} params.year the closed year
 * @param {string} params.hamletId
 * @param {Array<object>} params.lines the year's lines of this hamlet that are folded into the closing (with ids)
 * @param {(turn: number) => { monthIndex: number }} params.getTimeInfo
 * @param {string} params.date ISO date of the closing
 * @returns {object} the closing line, ready to be written
 */
export function buildYearClosingLine({ year, hamletId, lines, getTimeInfo, date }) {
  if (lines.length === 0) {
    throw new Error(`[journal] year ${year} has no line to close for hamlet ${hamletId}`);
  }
  let net = 0;
  const byType = {};
  const months = new Set();
  let lastTurn = -Infinity;
  for (const line of lines) {
    const direction = moneyDirectionOf(line);
    if (direction === 'credit') net += line.amount;
    else if (direction === 'debit') net -= line.amount;
    if (direction !== null) {
      byType[line.type] = (byType[line.type] ?? 0) + line.amount;
    }
    const timeInfo = getTimeInfo(line.turn);
    if (!timeInfo) {
      throw new Error(`[journal] line of turn ${line.turn} has no calendar time: the year ${year} cannot be closed`);
    }
    months.add(timeInfo.monthIndex);
    lastTurn = Math.max(lastTurn, line.turn);
  }
  return {
    type: YEAR_CLOSING_TYPE,
    turn: lastTurn,
    date,
    year,
    month: null,
    hamletId,
    amount: Math.abs(net),
    description: `Clôture de l'année ${year} (${lines.length} lignes)`,
    businessKey: `${YEAR_CLOSING_TYPE}:${hamletId}:${year}`,
    closing: {
      year,
      net,
      monthCount: months.size,
      lineCount: lines.length,
      byType,
    },
  };
}

/**
 * The lines a yearly view reads: each closing line is replaced by one line per journal type, with the year's total for
 * that type, so the sub-totals are the same as before the purge. Never written back: a view only.
 *
 * @param {Array<object>} entries
 * @returns {Array<object>}
 */
export function expandYearClosings(entries) {
  const expanded = [];
  for (const entry of entries) {
    if (entry.type !== YEAR_CLOSING_TYPE) {
      expanded.push(entry);
      continue;
    }
    const { closing } = entry;
    for (const [type, total] of Object.entries(closing.byType)) {
      expanded.push({
        turn: entry.turn,
        date: entry.date,
        type,
        amount: total,
        description: `Total de l'année ${closing.year} (année close)`,
        year: closing.year,
        month: null,
        hamletId: entry.hamletId,
        closed: true,
      });
    }
  }
  return expanded;
}
