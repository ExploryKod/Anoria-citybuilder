import { resolveStartingFunds } from '../../../domain/policies/TreasuryInitializationPolicy.js';
import { DEFAULT_INITIAL_FUNDS } from '../../../domain/catalogs/TreasuryCatalog.js';

/**
 * Initialize treasury row and capital_funds journal entry if needed.
 *
 * @param {object} [options]
 * @param {boolean} [options.clearExisting=true] — false = ensure-only (GetTreasurySnapshot race-safe)
 */
export class InitializeTreasury {
  /**
   * @param {import('../../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {import('../../../application/ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {{ execute: Function }} recordCapitalFundsIncome
   * @param {number} [defaultInitialFunds] Falls back to the canonical
   *   TreasuryCatalog default — callers going through createAccountingContext
   *   always pass the resolved (env-aware) value explicitly.
   */
  constructor(
    treasuryRepository,
    journalRepository,
    recordCapitalFundsIncome,
    defaultInitialFunds = DEFAULT_INITIAL_FUNDS
  ) {
    this.treasuryRepository = treasuryRepository;
    this.journalRepository = journalRepository;
    this.recordCapitalFundsIncome = recordCapitalFundsIncome;
    this.defaultInitialFunds = defaultInitialFunds;
  }

  /**
   * @param {number|null} [startingFunds]
   * @param {{ clearExisting?: boolean }} [options]
   * @returns {Promise<object>}
   */
  async execute(startingFunds = null, { clearExisting = true } = {}) {
    const funds = resolveStartingFunds(startingFunds, this.defaultInitialFunds);

    if (!clearExisting) {
      const existing = await this.treasuryRepository.getNormalizedBudgetRow();
      if (existing) {
        return existing;
      }
    } else {
      await this.treasuryRepository.clearCurrentBudget();
    }

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
