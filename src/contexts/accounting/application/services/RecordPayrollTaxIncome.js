/**
 * Application service — monthly payroll tax income (journal + treasury).
 */
export class RecordPayrollTaxIncome {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {import('../commands/treasury/ApplyTreasuryMovement.js').ApplyTreasuryMovement} applyTreasuryMovement
   */
  constructor(recordLedgerEntry, applyTreasuryMovement) {
    this.recordLedgerEntry = recordLedgerEntry;
    this.applyTreasuryMovement = applyTreasuryMovement;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.amount
   * @param {string} params.description
   * @returns {Promise<{ recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'zero_amount',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'payroll_tax',
      amount: roundedAmount,
      description,
    });

    if (!ledgerResult.recorded) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: ledgerResult.reason,
      };
    }

    await this.applyTreasuryMovement.execute({
      category: 'payroll_tax',
      amount: roundedAmount,
    });

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    };
  }
}
