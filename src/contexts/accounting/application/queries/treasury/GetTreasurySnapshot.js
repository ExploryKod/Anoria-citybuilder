import config from '../../../../../js/game/config.js';

/**
 * Load treasury snapshot, auto-initialize if missing.
 */
export class GetTreasurySnapshot {
  /**
   * @param {import('../../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {import('../commands/treasury/InitializeTreasury.js').InitializeTreasury} initializeTreasury
   */
  constructor(treasuryRepository, initializeTreasury) {
    this.treasuryRepository = treasuryRepository;
    this.initializeTreasury = initializeTreasury;
  }

  /** @returns {Promise<object>} */
  async execute() {
    let budget = await this.treasuryRepository.getNormalizedBudgetRow();

    if (!budget) {
      budget = await this.initializeTreasury.execute(null);
    }

    return budget;
  }
}

export function resolveStartingFunds(startingFunds = null) {
  if (startingFunds !== null) {
    return startingFunds;
  }
  return config?.budget?.initialFunds || 200;
}
