import { resolveStartingFunds } from '../../../domain/policies/TreasuryInitializationPolicy.js';

/**
 * Reset the journal (the treasury's only record) and record a new starting capital. New game only.
 */
export class ForceReinitializeTreasury {
  /**
   * @param {import('./InitializeTreasury.js').InitializeTreasury} initializeTreasury
   * @param {{ clear: () => Promise<void> }} journalClearPort
   * @param {number} defaultInitialFunds
   */
  constructor(initializeTreasury, journalClearPort, defaultInitialFunds) {
    this.initializeTreasury = initializeTreasury;
    this.journalClearPort = journalClearPort;
    this.defaultInitialFunds = defaultInitialFunds;
  }

  /** @param {number|null} [startingFunds] */
  async execute(startingFunds = null) {
    resolveStartingFunds(startingFunds, this.defaultInitialFunds);
    await this.journalClearPort.clear();
    return this.initializeTreasury.execute(startingFunds);
  }
}
