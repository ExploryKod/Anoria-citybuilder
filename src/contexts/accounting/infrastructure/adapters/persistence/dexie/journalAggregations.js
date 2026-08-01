/**
 * Journal read-model aggregations — shared by DexieJournalRepository and legacy JournalManager.
 * Rules unchanged from stores/JournalManager.js (Phase 2a extraction).
 */


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
 * Balance classification (loan_capital NOT in initial income set — legacy behavior).
 *
 * @param {object} entry
 * @param {Array<object>} allEntries
 * @param {(turn: number) => { year: number, monthIndex?: number }|null} getTimeInfo
 */
export function isJournalEntryIncomeForBalance(entry, allEntries, getTimeInfo) {
  let isIncome =
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
    entry.type === 'capital_funds';

  if (entry.type.startsWith('import_')) {
    isIncome = false;
  }

  if (entry.type.startsWith('export_')) {
    isIncome = true;
  }

  if (entry.type === 'loan_capital' || entry.type === 'construction_refund') {
    isIncome = true;
  }

  if (entry.type === 'carry_forward') {
    const signMatch = entry.description?.match(/\(([+-])\)/);
    if (signMatch) {
      isIncome = signMatch[1] === '+';
    } else {
      const timeInfo = getTimeInfo(entry.turn);
      if (!timeInfo) {
        isIncome = true;
      } else {
        const previousYear = timeInfo.year - 1;
        if (previousYear >= 0) {
          let prevYearIncome = 0;
          let prevYearExpenses = 0;

          allEntries.forEach((e) => {
            if (e.type === 'carry_forward') return;

            const eTimeInfo = getTimeInfo(e.turn);
            if (!eTimeInfo) return;

            if (eTimeInfo.year === previousYear) {
              let isEIncome =
                e.type === 'citizen_tax' ||
                e.type === 'payroll_tax' ||
                e.type === 'capital_funds' ||
                e.type === 'loan_capital';
              if (e.type.startsWith('import_')) {
                isEIncome = false;
              }
              if (e.type.startsWith('export_')) {
                isEIncome = true;
              }
              if (isEIncome) {
                prevYearIncome += e.amount;
              } else {
                prevYearExpenses += e.amount;
              }
            }
          });

          const prevYearNetFlow = prevYearIncome - prevYearExpenses;
          isIncome = prevYearNetFlow >= 0;
        } else {
          isIncome = true;
        }
      }
    }
  }

  return isIncome;
}

/**
 * @param {Array<object>} entries
 * @param {(turn: number) => { year: number, monthIndex?: number, month?: string }|null} getTimeInfo
 */
export function buildMonthlyFinancialSummary(entries, getTimeInfo) {
  const grouped = {};

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
        businessKey: entry.businessKey,
        partnerId: entry.partnerId,
        buildingInstanceId: entry.buildingInstanceId,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
        turn: entry.turn,
        isCarryForwardIncome: entry.type === 'carry_forward' ? true : undefined,
      });
    } else {
      grouped[key].expenses.total += entry.amount;
      grouped[key].expenses.entries.push({
        id: entry.id,
        businessKey: entry.businessKey,
        partnerId: entry.partnerId,
        buildingInstanceId: entry.buildingInstanceId,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
        turn: entry.turn,
        isCarryForwardIncome: entry.type === 'carry_forward' ? false : undefined,
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

/**
 * @param {Array<object>} entries
 * @param {(turn: number) => { year: number, monthIndex?: number }|null} getTimeInfo
 */
export function computeJournalCurrentBalance(entries, getTimeInfo) {
  let balance = 0;

  entries.forEach((entry) => {
    if (isInformativeJournalType(entry.type)) {
      return;
    }

    const isIncome = isJournalEntryIncomeForBalance(entry, entries, getTimeInfo);

    if (isIncome) {
      balance += entry.amount;
    } else {
      balance -= entry.amount;
    }
  });

  return balance;
}
