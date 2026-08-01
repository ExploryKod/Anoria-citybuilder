/**
 * Application service — commerce export income (journal + treasury).
 * Each call creates a distinct ledger line (no businessKey).
 */
export class RecordCommerceExportIncome {
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
   * @param {string} params.productId
   * @param {string|null} [params.partnerId]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, productId, partnerId = null }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'zero_amount',
      };
    }

    if (!productId) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'invalid_product_id',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: `export_${productId}`,
      amount: roundedAmount,
      description,
      partnerId,
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
      category: 'commerce_export',
      amount: roundedAmount,
      productId,
    });

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    };
  }
}
