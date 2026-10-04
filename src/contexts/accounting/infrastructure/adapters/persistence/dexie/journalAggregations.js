/**
 * Journal read-model aggregations — shared by DexieJournalRepository and legacy JournalManager.
 * Rules unchanged from stores/JournalManager.js (Phase 2a extraction).
 */


import { expandYearClosings } from '../../../../domain/policies/YearClosingPolicy.js';
import {
  isInformativeJournalType,
  isJournalEntryIncomeForMonthlySummary,
} from '../../../../domain/policies/JournalEntryClassificationPolicy.js';

export { isInformativeJournalType, isJournalEntryIncomeForMonthlySummary };

/**
 * @param {Array<object>} entries
 * @param {number|null} maxAge days
 */
export function filterAndSortJournalEntries(entries, maxAge = null) {
  let filtered = entries;

  if (maxAge) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);
    filtered = filtered.filter(
      (entry) => new Date(entry.date) >= cutoffDate
    );
  }

  return filtered.sort((a, b) => {
    if (a.turn !== b.turn) {
      return b.turn - a.turn;
    }
    return new Date(b.date) - new Date(a.date);
  });
}

/**
 * Entries of one hamlet, or every entry when `hamletId` is null. Applied before any aggregation, so that
 * classification rules that look at the other entries only ever see the hamlet's own journal.
 *
 * @param {Array<object>} entries
 * @param {string|null} hamletId
 */
export function filterJournalEntriesByHamlet(entries, hamletId) {
  if (hamletId == null) return entries;
  return entries.filter((entry) => {
    if (typeof entry.hamletId !== 'string' || entry.hamletId.length === 0) {
      throw new Error(`[journal] entry ${entry.id ?? entry.type} (turn ${entry.turn}) has no hamletId, cannot be scoped to a hamlet`);
    }
    return entry.hamletId === hamletId;
  });
}


/**
 * @param {Array<object>} entries
 * @param {(turn: number) => { year: number, monthIndex?: number, month?: string }|null} getTimeInfo
 */
export function buildMonthlyFinancialSummary(entries, getTimeInfo) {
  const grouped = {};
  // A closed year is shown from its per-type totals, so its sub-totals and its months stay as they were.
  entries = expandYearClosings(entries);

  entries.forEach((entry) => {
    const timeInfo = getTimeInfo(entry.turn);
    if (!timeInfo) {
      return;
    }

    const key = `${timeInfo.year}-${timeInfo.monthIndex}`;

    if (!grouped[key]) {
      grouped[key] = {
        year: timeInfo.year,
        month: timeInfo.monthIndex,
        monthName: timeInfo.month,
        income: { total: 0, entries: [] },
        expenses: { total: 0, entries: [] },
        entryCount: 0,
      };
    }

    if (isInformativeJournalType(entry.type)) {
      return;
    }

    const isIncome = isJournalEntryIncomeForMonthlySummary(
      entry,
      entries,
      getTimeInfo
    );

    if (isIncome) {
      grouped[key].income.total += entry.amount;
      grouped[key].income.entries.push({
        id: entry.id,
        hamletId: entry.hamletId,
        businessKey: entry.businessKey,
        partnerId: entry.partnerId,
        buildingInstanceId: entry.buildingInstanceId,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
        turn: entry.turn,
      });
    } else {
      grouped[key].expenses.total += entry.amount;
      grouped[key].expenses.entries.push({
        id: entry.id,
        hamletId: entry.hamletId,
        businessKey: entry.businessKey,
        partnerId: entry.partnerId,
        buildingInstanceId: entry.buildingInstanceId,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
        turn: entry.turn,
      });
    }

    grouped[key].entryCount++;
  });

  Object.values(grouped).forEach((month) => {
    month.netFlow = month.income.total - month.expenses.total;
  });

  return Object.values(grouped).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

/** @param {Array<object>} monthlyData */
export function buildYearlyFinancialSummary(monthlyData) {
  const grouped = {};

  monthlyData.forEach((month) => {
    const year = month.year;

    if (!grouped[year]) {
      grouped[year] = {
        year,
        income: { total: 0, entries: [] },
        expenses: { total: 0, entries: [] },
        monthCount: 0,
        months: [],
      };
    }

    grouped[year].income.total += month.income.total;
    grouped[year].expenses.total += month.expenses.total;
    grouped[year].income.entries.push(...month.income.entries);
    grouped[year].expenses.entries.push(...month.expenses.entries);
    grouped[year].monthCount++;
    grouped[year].months.push(month);
  });

  Object.values(grouped).forEach((year) => {
    year.netFlow = year.income.total - year.expenses.total;
    year.months.sort((a, b) => a.month - b.month);
  });

  return Object.values(grouped).sort((a, b) => b.year - a.year);
}

