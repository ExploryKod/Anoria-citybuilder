import { buildLoanCapitalBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — loan principal draw (journal + treasury).
 * Idempotent per loan contract when `loanId` is provided.
 */
export class RecordLoanCapitalIncome {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   */
  constructor(recordLedgerEntry) {
    this.recordLedgerEntry = recordLedgerEntry;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.amount
   * @param {string} params.description
   * @param {string|null} [params.loanId]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, loanId = null, loan = null }) {
    if (!loanId || !loan) {
      // A draw without its contract cannot be followed: its schedule would be unknown.
      throw new Error('[loan] a loan draw needs its loan id and contract (remainingTurns)');
    }
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        reason: 'zero_amount',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'loan_capital',
      amount: roundedAmount,
      description,
      businessKey: buildLoanCapitalBusinessKey(loanId),
      loanId,
      loan,
    });

    if (!ledgerResult.recorded) {
      return {
        recorded: false,
        skipped: true,
        reason: ledgerResult.reason,
      };
    }

    return {
      recorded: true,
      skipped: false,
    };
  }
}
