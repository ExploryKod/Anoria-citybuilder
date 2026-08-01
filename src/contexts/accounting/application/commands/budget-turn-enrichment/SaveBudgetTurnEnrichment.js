import { buildBudgetTurnEnrichmentSnapshot } from '../../../domain/policies/BudgetTurnEnrichmentPolicy.js';
import { GetFinancialHealth } from '../../queries/treasury/GetFinancialHealth.js';
import { GetTreasurySnapshot } from '../../queries/treasury/GetTreasurySnapshot.js';

/**
 * Persists a budget_turn_* enrichment snapshot (UI cache every N turns).
 */
export class SaveBudgetTurnEnrichment {
  /**
   * @param {import('../../ports/BudgetTurnEnrichmentRepository.js').BudgetTurnEnrichmentRepositoryPort} budgetTurnEnrichmentRepository
   * @param {GetTreasurySnapshot} getTreasurySnapshot
   * @param {GetFinancialHealth} getFinancialHealth
   */
  constructor(budgetTurnEnrichmentRepository, getTreasurySnapshot, getFinancialHealth) {
    this.budgetTurnEnrichmentRepository = budgetTurnEnrichmentRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.getFinancialHealth = getFinancialHealth;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {{ population?: number, buildingCounts?: object }} [params.additionalData]
   * @returns {Promise<object>} Persisted Dexie row
   */
  async execute({ turn, additionalData = {} }) {
    const [treasurySnapshot, financialHealth] = await Promise.all([
      this.getTreasurySnapshot.execute(),
      this.getFinancialHealth.execute(),
    ]);

    const snapshot = buildBudgetTurnEnrichmentSnapshot({
      turn,
      treasurySnapshot,
      financialHealth,
      additionalData,
    });

    return this.budgetTurnEnrichmentRepository.saveEnrichment(snapshot);
  }
}
