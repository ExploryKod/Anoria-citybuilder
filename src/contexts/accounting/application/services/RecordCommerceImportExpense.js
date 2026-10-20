/**
 * Application service — commerce import charge (journal + treasury).
 * Each call creates a distinct ledger line (no businessKey).
 */
export class RecordCommerceImportExpense {
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
   * @param {string} params.productId
   * @param {string|null} [params.partnerId]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, productId, partnerId = null }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        reason: 'zero_amount',
      };
    }

    if (!productId) {
      return {
        recorded: false,
        skipped: true,
        reason: 'invalid_product_id',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: `import_${productId}`,
      amount: roundedAmount,
      description,
      partnerId,
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
