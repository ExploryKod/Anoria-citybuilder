import { buildContributionBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — contribution pour révéler une dépêche (journal + trésorerie).
 */
export class RecordContributionExpense {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {{ execute: () => Promise<object> }} getTreasurySnapshot
   */
  constructor(recordLedgerEntry, getTreasurySnapshot) {
    this.recordLedgerEntry = recordLedgerEntry;
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.amount
   * @param {string} params.newsItemId
   * @param {string} [params.description]
   * @param {string} [params.channelId]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, newsItemId, description, channelId = 'caravan' }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        reason: 'zero_amount',
      };
    }

    if (!newsItemId) {
      return {
        recorded: false,
        skipped: true,
        reason: 'invalid_news_item_id',
      };
    }

    const budget = await this.getTreasurySnapshot.execute();
    if ((budget?.funds ?? 0) < roundedAmount) {
      return {
        recorded: false,
        skipped: true,
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
        reason: ledgerResult.reason,
      };
    }

    return {
      recorded: true,
      skipped: false,
    };
  }
}
