import {
  buildInfoMovementBusinessKey,
  formatInfoMovementDescription,
  infoJournalTypeFor,
} from '../../domain/policies/LedgerInformativeTypePolicy.js';

/**
 * Application service — unpaid loan installment (informative journal only, no treasury).
 */
export class RecordInfoLoanInstallment {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   */
  constructor(recordLedgerEntry) {
    this.recordLedgerEntry = recordLedgerEntry;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} [params.interestAmount]
   * @param {number} [params.principalAmount]
   * @param {string} params.loanId
   * @param {string} [params.loanType] — `bank` | `commercial`
   * @returns {Promise<{ recorded: boolean, skipped: boolean, linesRecorded: number, reason?: string }>}
   */
  async execute({
    turn,
    interestAmount = 0,
    principalAmount = 0,
    loanId,
    loanType = 'bank',
  }) {
    if (!loanId) {
      return {
        recorded: false,
        skipped: true,
        linesRecorded: 0,
        reason: 'missing_loan_id',
      };
    }

    const roundedInterest = Math.round(interestAmount);
    const roundedPrincipal = Math.round(principalAmount);

    if (roundedInterest <= 0 && roundedPrincipal <= 0) {
      return {
        recorded: false,
        skipped: true,
        linesRecorded: 0,
        reason: 'zero_amount',
      };
    }

    let linesRecorded = 0;
    const typeLabel = loanType === 'commercial' ? 'commercial' : 'bank';

    if (roundedInterest > 0) {
      const sourceType = 'loan_interest';
      const ledgerResult = await this.recordLedgerEntry.execute({
        turn,
        type: infoJournalTypeFor(sourceType),
        amount: roundedInterest,
        description: formatInfoMovementDescription(
          sourceType,
          `impayés, prêt ${typeLabel} (${loanId})`
        ),
        businessKey: buildInfoMovementBusinessKey(sourceType, loanId, turn),
      });

      if (!ledgerResult.recorded) {
        return {
          recorded: false,
          skipped: true,
          linesRecorded,
          reason: ledgerResult.reason,
        };
      }
      linesRecorded++;
    }

    if (roundedPrincipal > 0) {
      const sourceType = 'loan_repayment';
      const ledgerResult = await this.recordLedgerEntry.execute({
        turn,
        type: infoJournalTypeFor(sourceType),
        amount: roundedPrincipal,
        description: formatInfoMovementDescription(
          sourceType,
          `impayé, prêt ${typeLabel} (${loanId})`
        ),
        businessKey: buildInfoMovementBusinessKey(sourceType, loanId, turn),
      });

      if (!ledgerResult.recorded) {
        return {
          recorded: linesRecorded > 0,
          skipped: linesRecorded === 0,
          linesRecorded,
          reason: ledgerResult.reason,
        };
      }
      linesRecorded++;
    }

    return { recorded: linesRecorded > 0, skipped: false, linesRecorded };
  }
}
