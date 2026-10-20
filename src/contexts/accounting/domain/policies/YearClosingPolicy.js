/**
 * Year closing: when a full year is purged from the journal, its money lines are replaced by one `year_closing` line
 * per hamlet and year, which is an écriture of the plan comptable: the à-nouveaux (journal AN), the balance-sheet accounts the year ended with against the
 * carried result (12). The line keeps what the purge would otherwise lose:
 *   - the à-nouveaux, its legs: the treasury (the cash is the balance of 512), the balance sheet and the grand livre read them like any other écriture;
 *   - the net flow of the year, which is the treasury's effect of the year;
 *   - the year's totals per journal type, i.e. the sub-totals the yearly summary and the city ledger show (a digest, never a leg).
 *
 * Loan lines are kept as they are: a loan whose schedule runs past the purge still needs its contract and installments.
 */
import { moneyDirectionOf } from './TreasuryFromJournalPolicy.js';
import { accountKeyOf } from './AccountKeyPolicy.js';
import { postingsOf } from './AccountLedgerPolicy.js';
import { buildingTypeOfConstruction } from './MonthClosingPolicy.js';
import { OPENING_JOURNAL, assertBalanced, cashFlowsOfLegs, entryLegsOf, isEcriture } from './EntryLegsPolicy.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

export const YEAR_CLOSING_TYPE = 'year_closing';

/** The account that carries the result of the years closed. */
const CARRIED_RESULT = '12';

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
 * One closing per hamlet, year and account: the city's lines (no account) and each building's own lines are closed apart,
 * so a purge moves no balance, neither the city's nor a building's.
 * @param {object} params
 * @param {number} params.year the closed year
 * @param {string} params.hamletId
 * @param {string | null} params.accountBuildingId the account the lines belong to, null for the city
 * @param {string | null} params.accountKind the house's account (particulier or entreprise), null for a company or the city
 * @param {Array<object>} params.lines the year's lines of this hamlet and account that are folded into the closing (with ids)
 * @param {(turn: number) => { monthIndex: number }} params.getTimeInfo
 * @returns {object} the closing line, ready to be written
 */
export function buildYearClosingLine({ year, hamletId, accountBuildingId, accountKind, lines, getTimeInfo }) {
  if (accountBuildingId === undefined) throw new Error('[journal] a year closing needs its account (null for the city)');
  if (lines.length === 0) {
    throw new Error(`[journal] year ${year} has no line to close for hamlet ${hamletId}`);
  }
  let net = 0;
  const byType = {};
  const months = new Set();
  // What the balance sheet needs of the year (in centimes while it is summed): each balance-sheet account's net (debit minus credit), the year's result
  // (the charges and products, credit minus debit), and what each building cost to build (only the city's account holds the constructions).
  const accountNets = new Map();
  const cashFlows = new Map();
  const assetNets = new Map();
  let resultCentimes = 0;
  const constructions = new Map();
  let lastTurn = -Infinity;
  for (const line of lines) {
    const direction = moneyDirectionOf(line);
    if (direction === 'credit') net += line.amount;
    else if (direction === 'debit') net -= line.amount;
    if (isEcriture(line.type)) {
      byType[line.type] = (byType[line.type] ?? 0) + line.amount;
      // What moved the cash, by the account the money came from or went to: the city's ledger reads a closed year from it.
      for (const flow of cashFlowsOfLegs(postingsOf(line))) {
        const kept = cashFlows.get(flow.account) ?? { in: 0, out: 0 };
        kept.in += flow.in;
        kept.out += flow.out;
        cashFlows.set(flow.account, kept);
      }
      for (const leg of postingsOf(line)) {
        const legNet = leg.debit - leg.credit;
        if (leg.account[0] === '6' || leg.account[0] === '7') resultCentimes -= legNet;
        else accountNets.set(leg.account, (accountNets.get(leg.account) ?? 0) + legNet);
        // The fixed assets the books carry, per building: the owner's closing needs to know which buildings are already in its books.
        if (leg.account === '213' && line.buildingInstanceId) assetNets.set(line.buildingInstanceId, (assetNets.get(line.buildingInstanceId) ?? 0) + legNet);
      }
    }
    if ((line.type === 'construction' || line.type === 'construction_refund') && line.buildingInstanceId) {
      const built = constructions.get(line.buildingInstanceId) ?? { centimes: 0, builtKey: null, type: null };
      built.centimes += (line.type === 'construction' ? 1 : -1) * Math.round(line.amount * 100);
      if (line.type === 'construction' && built.builtKey === null) {
        built.builtKey = line.year * MONTHS_PER_YEAR + (line.month - 1);
        built.type = buildingTypeOfConstruction(line);
      }
      constructions.set(line.buildingInstanceId, built);
    }
    const timeInfo = getTimeInfo(line.turn);
    if (!timeInfo) {
      throw new Error(`[journal] line of turn ${line.turn} has no calendar time: the year ${year} cannot be closed`);
    }
    months.add(timeInfo.monthIndex);
    lastTurn = Math.max(lastTurn, line.turn);
  }
  // The à-nouveaux (journal AN): one écriture, each balance-sheet account with its net as it stood at the year's end, against the carried result (12), which takes
  // what makes the legs even (a loss is its debit, a profit its credit). A purge keeps what the balance sheet reads, so it still balances once the lines are gone.
  const legs = [...accountNets]
    .filter(([, centimes]) => centimes !== 0)
    .map(([account, centimes]) => ({ account, debit: centimes > 0 ? centimes : 0, credit: centimes < 0 ? -centimes : 0 }));
  const carried = -legs.reduce((sum, leg) => sum + leg.debit - leg.credit, 0);
  if (carried !== 0) legs.push({ account: CARRIED_RESULT, debit: carried > 0 ? carried : 0, credit: carried < 0 ? -carried : 0 });
  return {
    type: YEAR_CLOSING_TYPE,
    turn: lastTurn,
    year,
    month: null,
    hamletId,
    accountBuildingId,
    accountKind,
    amount: Math.abs(net),
    description: `Clôture de l'année ${year} (${lines.length} lignes)`,
    businessKey: `${YEAR_CLOSING_TYPE}:${hamletId}:${year}:${accountKeyOf({ accountBuildingId, accountKind }) ?? 'city'}`,
    journal: OPENING_JOURNAL,
    legs: legs.length > 0 ? assertBalanced(legs, YEAR_CLOSING_TYPE) : legs,
    // What the closing keeps beside its écriture: a digest of the year that is gone (read-only, never a leg).
    closing: {
      year,
      net,
      monthCount: months.size,
      lineCount: lines.length,
      byType,
      // What moved the cash in the year, by account (centimes): the city's ledger reads the year from it once its lines are gone.
      cashFlows: Object.fromEntries([...cashFlows].map(([account, flow]) => [account, flow])),
      result: resultCentimes / 100,
      assets: Object.fromEntries([...assetNets].filter(([, centimes]) => centimes !== 0).map(([id, centimes]) => [id, centimes / 100])),
      constructions: Object.fromEntries(
        [...constructions]
          .filter(([, built]) => built.builtKey !== null)
          .map(([id, built]) => [id, { cost: built.centimes / 100, builtKey: built.builtKey, type: built.type }]),
      ),
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
      // The year's total of a type is read as one entry of that type, booked as the journal books it: a view of a year that is gone, never written back.
      const { journal, legs } = entryLegsOf({ type, amount: total, accountBuildingId: entry.accountBuildingId ?? null });
      expanded.push({
        turn: entry.turn,
        type,
        journal,
        legs,
        amount: total,
        description: `Total de l'année ${closing.year} (année close)`,
        year: closing.year,
        month: null,
        hamletId: entry.hamletId,
        accountBuildingId: entry.accountBuildingId ?? null,
        accountKind: entry.accountKind ?? null,
        closed: true,
      });
    }
  }
  return expanded;
}
