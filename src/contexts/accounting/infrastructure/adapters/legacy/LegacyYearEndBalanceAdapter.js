import { YearEndBalancePort } from '../../../application/ports/YearEndBalancePort.js';

const LOCALSTORAGE_KEY = 'journal_year_end_balances';

/**
 * localStorage adapter — same key as legacy JournalManager.
 */
export class LegacyYearEndBalanceAdapter extends YearEndBalancePort {
  /** @inheritdoc */
  async getYearEndBalance(year) {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (!stored) {
        return null;
      }

      const soldes = JSON.parse(stored);
      const yearSoldes = soldes.filter((s) => s.an === year);
      if (yearSoldes.length === 0) {
        return null;
      }

      yearSoldes.sort((a, b) => (b.turn || 0) - (a.turn || 0));
      const row = yearSoldes[0];
      return {
        amount: row.amount,
        nature: row.nature === 'deficit' ? 'deficit' : 'revenue',
      };
    } catch {
      return null;
    }
  }

  /** @inheritdoc */
  async saveYearEndBalance(year, netFlow) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      let soldes = stored ? JSON.parse(stored) : [];
      soldes = soldes.filter((s) => s.an !== year);

      const nature = netFlow >= 0 ? 'revenue' : 'deficit';
      soldes.push({
        an: year,
        nature,
        amount: Math.abs(netFlow),
      });
      soldes.sort((a, b) => a.an - b.an);
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(soldes));
    } catch (error) {
      console.error('[LegacyYearEndBalanceAdapter] save failed:', error);
    }
  }

  /** @inheritdoc */
  async listAllYearEndBalances() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
}
