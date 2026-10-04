import db from '../../../../../../core/persistence/dexie/db.js';
import { TreasuryRepository } from '../../../../application/ports/TreasuryRepository.js';

export const CURRENT_BUDGET_NAME = 'budget_current';

/**
 * Accounting BC — the `budget_current` row. It holds only the turn; the money is in the journal.
 * Balance, flows and loans are derived from the journal (GetTreasurySnapshot), so this row never stores them.
 */
export class DexieTreasuryRepository extends TreasuryRepository {
  /** @param {object} [deps] @param {import('dexie').Dexie} [deps.db] */
  constructor(deps = {}) {
    super();
    this.db = deps.db ?? db;
  }

  /** @returns {Promise<object|null>} */
  async getRawBudgetRow() {
    let budget = await this.db.budget.get(CURRENT_BUDGET_NAME);

    if (!budget) {
      const all = await this.db.budget.toArray();
      budget = all.find((row) => row.name === CURRENT_BUDGET_NAME) ?? all[0] ?? null;
    }

    return budget;
  }

  /**
   * Persist the turn. Every other figure of a treasury snapshot is derived from the journal and never stored.
   * @param {{ turn: number }} snapshot
   * @returns {Promise<void>}
   */
  async saveBudgetRow(snapshot) {
    await this.db.budget.put({ name: CURRENT_BUDGET_NAME, turn: snapshot.turn });
  }

  /** @returns {Promise<void>} */
  async clearCurrentBudget() {
    await this.db.budget.clear();
  }

  /**
   * Upsert `budget_current` at turn 0 (put — safe under concurrent init races).
   * @returns {Promise<object>}
   */
  async createInitialBudgetRow() {
    const row = { name: CURRENT_BUDGET_NAME, turn: 0 };
    await this.db.budget.put(row);
    return row;
  }
}
