/**
 * Application service — yearly citizen tax income (journal + treasury).
 */
export class RecordCitizenTaxIncome {
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
   * @param {number} params.taxYear Civil year of collection (for treasury + businessKey)
   * @param {object|null} [params.taxBreakdown]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, taxYear, taxBreakdown = null }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'zero_amount',
      };
    }

    if (typeof taxYear !== 'number' || Number.isNaN(taxYear)) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'invalid_tax_year',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'citizen_tax',
      amount: roundedAmount,
      description,
      businessKey: `citizen_tax:${taxYear}`,
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
      category: 'citizen_tax',
      amount: roundedAmount,
      taxBreakdown,
      taxYear,
    });

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    };
  }
}
