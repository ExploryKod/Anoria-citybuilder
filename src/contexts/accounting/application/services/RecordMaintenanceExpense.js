/**
 * Application service — maintenance monthly charge (journal + treasury).
 */
export class RecordMaintenanceExpense {
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
   * @param {object|null} [params.maintenanceBreakdown]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, maintenanceBreakdown = null }) {
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
      type: 'maintenance',
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
      category: 'maintenance',
      amount: roundedAmount,
      maintenanceBreakdown,
    });

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    };
  }
}
