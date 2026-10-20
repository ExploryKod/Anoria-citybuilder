import { constructionAccountOf, constructionLegs } from '../../domain/policies/ConstructionAccountPolicy.js';

/**
 * Application service — construction placement refund (journal + treasury).
 * Reverses a building investment debit without crediting operating income.
 */
export class RecordConstructionRefundIncome {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {() => Promise<boolean>} ownerStands whether the property company that owns the buildings exists (see ConstructionAccountPolicy)
   */
  constructor(recordLedgerEntry, ownerStands) {
    if (typeof ownerStands !== 'function') throw new Error('[construction] RecordConstructionRefundIncome needs to know whether the owner of the buildings stands (ownerStands)');
    this.recordLedgerEntry = recordLedgerEntry;
    this.ownerStands = ownerStands;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.amount
   * @param {string} params.description
   * @param {string|null} [params.buildingInstanceId]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, buildingInstanceId = null }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        reason: 'zero_amount',
      };
    }

    const account = constructionAccountOf({ description, refund: true, ownerStands: await this.ownerStands() });
    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'construction_refund',
      amount: roundedAmount,
      description,
      buildingInstanceId,
      legs: constructionLegs(account, roundedAmount, true),
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
