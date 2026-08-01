import { buildCommercialRouteBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — commercial route opening fee (journal + treasury).
 */
export class RecordCommercialRouteExpense {
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
   * @param {string} params.partnerId
   * @returns {Promise<{ recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, partnerId }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'zero_amount',
      };
    }

    if (!partnerId) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'invalid_partner_id',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'commercial_route',
      amount: roundedAmount,
      description,
      partnerId,
      businessKey: buildCommercialRouteBusinessKey(partnerId),
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
      category: 'commercial_route',
      amount: roundedAmount,
    });

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    };
  }
}
