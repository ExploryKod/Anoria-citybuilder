import { buildLedgerBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — yearly citizen tax income (journal + treasury), charged to the active hamlet.
 */
export class RecordCitizenTaxIncome {
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
   * @param {number} params.taxYear Civil year of collection (for treasury + businessKey)
   * @param {object|null} [params.taxBreakdown]
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, amount, description, taxYear, taxBreakdown = null }) {
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        recorded: false,
        skipped: true,
        reason: 'zero_amount',
      };
    }

    if (typeof taxYear !== 'number' || Number.isNaN(taxYear)) {
      return {
        recorded: false,
        skipped: true,
        reason: 'invalid_tax_year',
      };
    }

    const ledgerResult = await this.recordLedgerEntry.execute({
      turn,
      type: 'citizen_tax',
      amount: roundedAmount,
      description,
      businessKey: buildLedgerBusinessKey('citizen_tax', { year: taxYear }, requireActiveHamletId()),
      taxYear,
      taxBreakdown,
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
