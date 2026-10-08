import { buildLoanCapitalBusinessKey, buildLoanLenderBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — loan principal draw (journal + treasury).
 * Idempotent per loan contract when `loanId` is provided. When `lenderBuildingId` names a real bank, its own
 * account is also debited for the capital it lent out (a mirror line, same event — see
 * ProducerChargePolicy.js/SettleProducerCharges.js for how this funds the bank's own wages and tax).
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
   * @param {string|null} [params.lenderBuildingId] the bank whose account lent this capital; null keeps today's
   *   behaviour (no real lender — the amount still credits the city, nothing debits anywhere)
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, loanId = null, loan = null, lenderBuildingId = null }) {
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

    if (lenderBuildingId) {
      const lenderResult = await this.recordLedgerEntry.execute({
        turn,
        type: 'loan_capital_lent',
        amount: roundedAmount,
        description,
        businessKey: buildLoanLenderBusinessKey('loan_capital_lent', loanId),
        loanId,
        loan,
        accountBuildingId: lenderBuildingId,
      });
      if (!lenderResult.recorded && lenderResult.reason !== 'duplicate_business_key') {
        throw new Error(`[loan] the lender's capital line for ${loanId} was not recorded: ${lenderResult.reason}`);
      }
    }

    return {
      recorded: true,
      skipped: false,
    };
  }
}
