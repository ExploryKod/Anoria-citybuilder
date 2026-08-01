import { GetTreasurySnapshot } from '../../queries/treasury/GetTreasurySnapshot.js';

/**
 * Advance treasury turn counter and reset daily aggregates.
 */
export class UpdateTreasuryTurn {
  /**
   * @param {import('../../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {GetTreasurySnapshot} getTreasurySnapshot
   * @param {{ execute: Function }} syncTurnInformativeEntries
   */
  constructor(treasuryRepository, getTreasurySnapshot, syncTurnInformativeEntries) {
    this.treasuryRepository = treasuryRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.syncTurnInformativeEntries = syncTurnInformativeEntries;
  }

  /**
   * @param {number} turn
   * @returns {Promise<object>}
   */
  async execute(turn) {
    const budget = await this.getTreasurySnapshot.execute();
    const previousTurn = budget.turn || 0;

    budget.turn = turn;
    budget.dailyIncome = 0;
    budget.dailyExpenses = 0;

    await this.treasuryRepository.saveBudgetRow(budget);

    try {
      await this.syncTurnInformativeEntries.execute({
        turn,
        previousTurn,
        treasuryFunds: budget.funds,
      });
    } catch (error) {
      console.error('[UpdateTreasuryTurn] Error syncing informative journal entries:', error);
    }

    return budget;
  }
}
