import { resolveStartingFunds } from '../../../domain/policies/TreasuryInitializationPolicy.js';
import { DEFAULT_INITIAL_FUNDS } from '../../../domain/catalogs/TreasuryCatalog.js';

/**
 * Record the starting capital, the first line of the journal. The treasury is derived from it, so there is no other
 * record to create. Recording it twice is harmless: the capital's business key refuses the second line.
 */
export class InitializeTreasury {
  /**
   * @param {{ execute: Function }} recordCapitalFundsIncome
   * @param {number} [defaultInitialFunds] Falls back to the canonical
   *   TreasuryCatalog default — callers going through createAccountingContext
   *   always pass the resolved (env-aware) value explicitly.
   */
  constructor(recordCapitalFundsIncome, defaultInitialFunds = DEFAULT_INITIAL_FUNDS) {
    this.recordCapitalFundsIncome = recordCapitalFundsIncome;
    this.defaultInitialFunds = defaultInitialFunds;
  }

  /**
   * @param {number|null} [startingFunds]
   * @returns {Promise<{ recorded: boolean }>}
   */
  async execute(startingFunds = null) {
    const funds = resolveStartingFunds(startingFunds, this.defaultInitialFunds);
    return this.recordCapitalFundsIncome.execute({
      turn: 0,
      amount: funds,
      description: `Capital de départ: ${funds}€`,
    });
  }
}
