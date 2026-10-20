import { constructionAccountOf, constructionLegs } from '../../domain/policies/ConstructionAccountPolicy.js';

/**
 * Application service — construction charge (journal + treasury).
 * Each call creates a distinct ledger line (no businessKey).
 */
export class RecordConstructionExpense {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {() => Promise<boolean>} ownerStands whether the property company that owns the buildings exists: the city then holds what it builds through it (see ConstructionAccountPolicy)
   */
  constructor(recordLedgerEntry, ownerStands) {
    if (typeof ownerStands !== 'function') throw new Error('[construction] RecordConstructionExpense needs to know whether the owner of the buildings stands (ownerStands)');
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

    // The account the city books it against: a holding in the owner, its own building, or its own road. The journal books the legs it is given.
    const account = constructionAccountOf({ description, ownerStands: await this.ownerStands() });
    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'construction',
      amount: roundedAmount,
      description,
      buildingInstanceId,
      legs: constructionLegs(account, roundedAmount),
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
