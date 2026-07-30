import { TreasuryRepository } from '../../../application/ports/TreasuryRepository.js';

/**
 * Phase 1 adapter — delegates to BudgetManager.getCurrentBudget().funds
 */
export class LegacyTreasuryRepository extends TreasuryRepository {
  /** @param {import('../../../../../js/stores/BudgetManager.js').default|object} budgetManager */
  constructor(budgetManager) {
    super();
    this.budgetManager = budgetManager;
  }

  async getTreasuryBalance() {
    const budget = await this.budgetManager.getCurrentBudget();
    return budget.funds || 0;
  }
}
