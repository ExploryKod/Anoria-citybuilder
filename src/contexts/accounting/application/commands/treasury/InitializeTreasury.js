import { resolveStartingFunds } from '../../../domain/policies/TreasuryInitializationPolicy.js';

/**
 * Initialize treasury row and capital_funds journal entry if needed.
 */
export class InitializeTreasury {
  /**
   * @param {import('../../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {import('../../../application/ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {{ execute: Function }} recordCapitalFundsIncome
   * @param {number} [defaultInitialFunds=200]
   */
  constructor(
    treasuryRepository,
    journalRepository,
    recordCapitalFundsIncome,
    defaultInitialFunds = 200
  ) {
    this.treasuryRepository = treasuryRepository;
    this.journalRepository = journalRepository;
    this.recordCapitalFundsIncome = recordCapitalFundsIncome;
    this.defaultInitialFunds = defaultInitialFunds;
  }

  /**
   * @param {number|null} [startingFunds]
   * @returns {Promise<object>}
   */
  async execute(startingFunds = null) {
    const funds = resolveStartingFunds(startingFunds, this.defaultInitialFunds);

    await this.treasuryRepository.clearCurrentBudget();
    const initialBudget = await this.treasuryRepository.createInitialBudgetRow(funds);

    const existingEntries = await this.journalRepository.getJournalEntries();
    const hasCapitalFunds = existingEntries.some(
      (entry) => entry.type === 'capital_funds' && entry.turn === 0
    );

    if (!hasCapitalFunds) {
      await this.recordCapitalFundsIncome.execute({
        turn: 0,
        amount: funds,
        description: `Capital de départ: ${funds}€`,
      });
    }

    return initialBudget;
  }
}
