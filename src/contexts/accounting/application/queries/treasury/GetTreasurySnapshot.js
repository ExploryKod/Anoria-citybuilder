import { deriveTreasuryFigures, deriveLoanPortfolio, deriveCitizenTaxState, moneyDirectionOf } from '../../../domain/policies/TreasuryFromJournalPolicy.js';
import { accountKeyOf } from '../../../domain/policies/AccountKeyPolicy.js';

/**
 * The treasury as the journal says it is. The row keeps only what is not money (turn, tax breakdown, tax year); every
 * figure, the balance and the loans are derived from the journal lines, in the order they were written.
 */
export class GetTreasurySnapshot {
  /**
   * @param {{ execute: () => Promise<object> }} initializeTreasury
   * @param {{ getJournalEntries: () => Promise<Array<object>> }} journalRepository
   * @param {{ currentTurn: () => number }} gameTimePort the running game's clock: the only source of the turn
   */
  constructor(initializeTreasury, journalRepository, gameTimePort) {
    this.initializeTreasury = initializeTreasury;
    this.journalRepository = journalRepository;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {{ hamletId?: string|null, untilYear?: number|null, accountBuildingId?: string|null }} [options]
   *   hamletId: the hamlet's own treasury, or the whole city's when null.
   *   untilYear: the treasury as it stood at the end of that fiscal year (its lines and every earlier one), or now when null.
   *   accountBuildingId: a company's own account (its net profit stays there); null for the city's treasury, which holds
   *   no company line. accountKind: which of a house's two accounts (particulier or entreprise); null for a company's.
   * @returns {Promise<object>}
   */
  async execute({ hamletId = null, untilYear = null, accountBuildingId = null, accountKind = null } = {}) {
    let entries = await this.journalRepository.getJournalEntries();
    if (entries.length === 0) {
      // A brand-new game has no journal yet: its treasury starts from the capital line. Once any line exists, the
      // journal is the treasury and nothing is recreated: a purged capital is folded into a closing, not missing.
      await this.initializeTreasury.execute(null);
      entries = await this.journalRepository.getJournalEntries();
    }

    const accountKey = accountKeyOf({ accountBuildingId, accountKind });
    const inScope = (entry) =>
      (hamletId == null || hamletOf(entry) === hamletId) &&
      (untilYear == null || yearOf(entry) <= untilYear) &&
      accountKeyOf(entry) === accountKey;
    const scoped = entries.filter(inScope);
    const lines = treasuryLinesInOrder(scoped);
    const currentTurn = this.gameTimePort.currentTurn();
    const figures = deriveTreasuryFigures(lines, { currentTurn });
    const portfolio = deriveLoanPortfolio(lines);
    const citizenTax = deriveCitizenTaxState(lines);

    return {
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

/** @param {object} entry @returns {string} the hamlet a line belongs to; a line without one is an error. */
function hamletOf(entry) {
  if (typeof entry.hamletId !== 'string' || entry.hamletId.length === 0) {
    throw new Error(`[treasury] journal line ${entry.type} (turn ${entry.turn}) has no hamletId`);
  }
  return entry.hamletId;
}

/** @param {object} entry @returns {number} the fiscal year a line was stamped with; a line without one is an error. */
function yearOf(entry) {
  if (typeof entry.year !== 'number') {
    throw new Error(`[treasury] journal line ${entry.type} (turn ${entry.turn}) has no fiscal year stamp`);
  }
  return entry.year;
}
