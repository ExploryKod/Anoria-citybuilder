import { buildContributionBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — contribution pour révéler une dépêche (journal + trésorerie).
 */
export class RecordContributionExpense {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {import('../commands/treasury/ApplyTreasuryMovement.js').ApplyTreasuryMovement} applyTreasuryMovement
   * @param {{ execute: () => Promise<object> }} getTreasurySnapshot
   */
  constructor(recordLedgerEntry, applyTreasuryMovement, getTreasurySnapshot) {
    this.recordLedgerEntry = recordLedgerEntry;
    this.applyTreasuryMovement = applyTreasuryMovement;
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.amount
   * @param {string} params.newsItemId
   * @param {string} [params.description]
   * @param {string} [params.channelId]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, treasuryApplied: boolean, reason?: string }>}
   */
  async execute({ turn, amount, newsItemId, description, channelId = 'caravan' }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'zero_amount',
      };
    }

    if (!newsItemId) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'invalid_news_item_id',
      };
    }

    const budget = await this.getTreasurySnapshot.execute();
    if ((budget?.funds ?? 0) < roundedAmount) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'insufficient_funds',
      };
    }

    const businessKey = buildContributionBusinessKey(newsItemId);
    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'contribution',
      amount: roundedAmount,
      description:
        description ||
        `Contribution ${channelId} — dépêche ${newsItemId}`,
      businessKey,
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
      category: 'contribution',
      amount: roundedAmount,
    });

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    };
  }
}
