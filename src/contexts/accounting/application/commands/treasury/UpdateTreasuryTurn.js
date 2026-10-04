import { GetTreasurySnapshot } from '../../queries/treasury/GetTreasurySnapshot.js';

/**
 * Advance the treasury turn. Daily flows are derived from the turn, so nothing is reset here.
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
    await this.treasuryRepository.saveBudgetRow(budget);

    await this.syncTurnInformativeEntries.execute({
      turn,
      previousTurn,
      treasuryFunds: budget.funds,
    });

    return budget;
  }
}
