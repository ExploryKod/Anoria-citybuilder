import { deriveTreasuryFigures, deriveLoanPortfolio, deriveCitizenTaxState, moneyDirectionOf } from '../../../domain/policies/TreasuryFromJournalPolicy.js';

/**
 * The treasury as the journal says it is. The row keeps only what is not money (turn, tax breakdown, tax year); every
 * figure, the balance and the loans are derived from the journal lines, in the order they were written.
 */
export class GetTreasurySnapshot {
  /**
   * @param {import('../../../infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository
   * @param {import('../commands/treasury/InitializeTreasury.js').InitializeTreasury} initializeTreasury
   * @param {{ getJournalEntries: () => Promise<Array<object>> }} journalRepository
   */
  constructor(treasuryRepository, initializeTreasury, journalRepository) {
    this.treasuryRepository = treasuryRepository;
    this.initializeTreasury = initializeTreasury;
    this.journalRepository = journalRepository;
  }

  /** @returns {Promise<object>} */
  async execute() {
    let row = await this.treasuryRepository.getRawBudgetRow();

    if (!row) {
      // Ensure-only: never clear (avoids ConstraintError races with ForceReinitialize / concurrent snapshots)
      row = await this.initializeTreasury.execute(null, { clearExisting: false });
    }

    const entries = await this.journalRepository.getJournalEntries();
    const lines = treasuryLinesInOrder(entries);
    const currentTurn = row.turn ?? 0;
    const figures = deriveTreasuryFigures(lines, { currentTurn });
    const portfolio = deriveLoanPortfolio(lines);
    const citizenTax = deriveCitizenTaxState(lines);

    return {
      name: row.name,
      turn: currentTurn,
      taxBreakdown: citizenTax.taxBreakdown,
      lastTaxYear: citizenTax.lastTaxYear,
      ...figures,
      loans: portfolio.loans,
      loanDebt: portfolio.loanDebt,
    };
  }
}

/**
 * The journal lines the treasury is folded from (money movements and the loan installments that move the schedule),
 * in the order they were written. The id is assigned when a line is written, so it is that order; a line without an id
 * was never written and must not be folded into the treasury.
 * @param {Array<object>} entries
 * @returns {Array<object>}
 */
function treasuryLinesInOrder(entries) {
  const lines = entries.filter((entry) => moneyDirectionOf(entry) !== null || entry.type.startsWith('info_loan_'));
  for (const line of lines) {
    if (typeof line.id !== 'number') {
      throw new Error(`[treasury] journal line ${line.type} (turn ${line.turn}) has no id: it was never written`);
    }
  }
  return lines.sort((a, b) => a.id - b.id);
}
