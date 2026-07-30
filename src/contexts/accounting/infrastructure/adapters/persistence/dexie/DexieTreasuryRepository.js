import db from '../../../../../../core/persistence/dexie/db.js';
import { TreasuryRepository } from '../../../../application/ports/TreasuryRepository.js';

const CURRENT_BUDGET_NAME = 'budget_current';

/**
 * Accounting BC — direct Dexie access to co-maintained treasury (`budget_current.funds`).
 */
export class DexieTreasuryRepository extends TreasuryRepository {
  /**
   * @param {object} [deps]
   * @param {import('dexie').Dexie} [deps.db]
   */
  constructor(deps = {}) {
    super();
    this.db = deps.db ?? db;
  }

  /** @returns {Promise<number>} */
  async getTreasuryBalance() {
    let budget = await this.db.budget.get(CURRENT_BUDGET_NAME);

    if (!budget) {
      const all = await this.db.budget.toArray();
      budget = all[0] ?? null;
    }

    if (!budget || typeof budget.funds !== 'number') {
      return 0;
    }

    return Math.round(budget.funds);
  }
}
