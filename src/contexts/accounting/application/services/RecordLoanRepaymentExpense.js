import { buildLoanInstallmentBusinessKey, buildLoanLenderBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — loan principal repayment (journal + treasury).
 * Idempotent per loan + turn when `loanId` is provided. When `lenderBuildingId` names a real bank, its own account
 * also receives the principal back (a mirror line, same event).
 */
export class RecordLoanRepaymentExpense {
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
   * @param {string|null} [params.lenderBuildingId] the bank receiving this principal back; null keeps today's behaviour
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, loanId = null, lenderBuildingId = null }) {
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
      type: 'loan_repayment',
      amount: roundedAmount,
      description,
      businessKey: buildLoanInstallmentBusinessKey('loan_repayment', loanId, turn),
      loanId,
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
        type: 'loan_repayment_received',
        amount: roundedAmount,
        description,
        businessKey: buildLoanLenderBusinessKey('loan_repayment_received', loanId, turn),
        loanId,
        accountBuildingId: lenderBuildingId,
      });
      if (!lenderResult.recorded && lenderResult.reason !== 'duplicate_business_key') {
        throw new Error(`[loan] the lender's repayment line for ${loanId} (turn ${turn}) was not recorded: ${lenderResult.reason}`);
      }
    }

    return {
      recorded: true,
      skipped: false,
    };
  }
}
