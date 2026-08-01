import db from '../../../../../../core/persistence/dexie/db.js';

/**
 * Read/write access to budget_turn_* rows — enrichment cache only (NOT source for CR totals).
 *
 * `budget_current` remains the live treasury cumul row; never deleted.
 */
export class BudgetTurnEnrichmentRepository {
  /** @param {import('dexie').Dexie} [dexieDb] */
  constructor(dexieDb = db) {
    this.db = dexieDb;
  }

  /** @returns {Promise<Array<object>>} */
  async listSnapshotRows() {
    const all = await this.db.budget.toArray();
    return all
      .filter((row) => row.name?.startsWith('budget_turn_'))
      .sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0));
  }

  /**
   * @param {number} turn
   * @returns {Promise<object|null>}
   */
  async getEnrichmentAtTurn(turn) {
    const row = await this.db.budget.get(`budget_turn_${turn}`);
    if (!row) {
      return null;
    }

    return {
      turn: row.turn,
      funds: row.funds,
      population: row.population ?? 0,
      buildingCounts: row.buildingCounts ?? {},
      taxBreakdown: row.taxBreakdown ?? null,
      maintenanceBreakdown: row.maintenanceBreakdown ?? null,
      loanDebt: row.loanDebt ?? 0,
      financialHealth: row.financialHealth ?? null,
      totalBuildingMaintenance: row.totalBuildingMaintenance ?? 0,
      totalLoanInterestExpenses: row.totalLoanInterestExpenses ?? 0,
      totalLoanRepayments: row.totalLoanRepayments ?? 0,
      date: row.date ?? null,
    };
  }

  /**
   * @param {import('../../../domain/read-models/BudgetTurnEnrichmentSnapshot.js').BudgetTurnEnrichmentSnapshot} snapshot
   * @returns {Promise<object>} Persisted Dexie row
   */
  async saveEnrichment(snapshot) {
    const row = {
      name: `budget_turn_${snapshot.turn}`,
      ...snapshot,
    };

    try {
      await this.db.budget.add(row);
      return row;
    } catch (err) {
      if (err.name === 'ConstraintError') {
        await this.db.budget.put(row);
        return row;
      }
      throw err;
    }
  }
}
