import { resolveStartingFunds } from '../../../domain/policies/TreasuryInitializationPolicy.js';
import { DEFAULT_INITIAL_FUNDS } from '../../../domain/catalogs/TreasuryCatalog.js';

/**
 * Record the starting capital, the first line of the journal. The treasury is derived from it, so there is no other
 * record to create. Recording it twice is harmless: the capital's business key refuses the second line.
 */
export class InitializeTreasury {
  /**
   * @param {{ execute: Function }} recordCapitalFundsIncome
   * @param {number} defaultInitialFunds the resolved (env-aware) starting capital
   * @param {{ hasAnyEntry: () => Promise<boolean> }} journal Says whether the journal already holds a line (or a year closing).
   */
  constructor(recordCapitalFundsIncome, defaultInitialFunds = DEFAULT_INITIAL_FUNDS, journal) {
    if (!journal?.hasAnyEntry) throw new Error('[treasury] InitializeTreasury needs the journal port (hasAnyEntry)');
    this.recordCapitalFundsIncome = recordCapitalFundsIncome;
    this.defaultInitialFunds = defaultInitialFunds;
    this.journal = journal;
  }

  /**
   * The capital is recorded only into an empty journal: once a purge has folded it into a year closing its business key
   * is gone, and a second capital line would be a phantom gift closed again at every purge.
   * @param {number|null} [startingFunds]
   * @returns {Promise<{ recorded: boolean }>}
   */
  async execute(startingFunds = null) {
    if (await this.journal.hasAnyEntry()) return { recorded: false, skipped: true, reason: 'journal_not_empty' };
    const funds = resolveStartingFunds(startingFunds, this.defaultInitialFunds);
    return this.recordCapitalFundsIncome.execute({
      turn: 0,
      amount: funds,
      description: `Capital de départ: ${funds}€`,
    });
  }
}
