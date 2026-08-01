import { buildCapitalFundsBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — initial capital journal line at game start.
 * Treasury funds and income are pre-seeded in `BudgetManager.initialize()` — journal only.
 */
export class RecordCapitalFundsIncome {
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
      type: 'capital_funds',
      amount: roundedAmount,
      description,
      businessKey: buildCapitalFundsBusinessKey(),
    });

    if (!ledgerResult.recorded) {
      return {
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: ledgerResult.reason,
      };
    }

    return {
      recorded: true,
      skipped: false,
      treasuryApplied: false,
    };
  }
}
