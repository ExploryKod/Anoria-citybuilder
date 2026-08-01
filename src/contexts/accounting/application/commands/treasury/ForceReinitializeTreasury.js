import { resolveStartingFunds } from '../../../domain/policies/TreasuryInitializationPolicy.js';

/**
 * Reset treasury + journal and reinitialize (new game / corrupted data).
 */
export class ForceReinitializeTreasury {
  /**
   * @param {import('../../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {import('../../../application/ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('./InitializeTreasury.js').InitializeTreasury} initializeTreasury
   * @param {{ clear?: () => Promise<void> }} [journalClearPort]
   */
  constructor(
    treasuryRepository,
    journalRepository,
    initializeTreasury,
    journalClearPort = null
  ) {
    this.treasuryRepository = treasuryRepository;
    this.journalRepository = journalRepository;
    this.initializeTreasury = initializeTreasury;
    this.journalClearPort = journalClearPort;
  }

  /**
   * @param {number|null} [startingFunds]
   * @returns {Promise<object>}
   */
  async execute(startingFunds = null) {
    resolveStartingFunds(startingFunds, this.initializeTreasury.defaultInitialFunds);

    if (this.journalClearPort?.clear) {
      await this.journalClearPort.clear();
    }

    await this.treasuryRepository.clearCurrentBudget();
    return this.initializeTreasury.execute(startingFunds);
  }
}
