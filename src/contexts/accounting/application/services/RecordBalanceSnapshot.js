/**
 * Application service — session-only treasury snapshot per turn (informative).
 */
export class RecordBalanceSnapshot {
  /**
   * @param {import('../../ports/JournalWritePort.js').JournalWritePort} journalWritePort
   */
  constructor(journalWritePort) {
    this.journalWritePort = journalWritePort;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.amount
   */
  async execute({ turn, amount }) {
    if (typeof turn !== 'number' || Number.isNaN(turn)) {
      return { recorded: false, skipped: true, reason: 'invalid_turn' };
    }
    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return { recorded: false, skipped: true, reason: 'invalid_amount' };
    }

    await this.journalWritePort.upsertBalanceSnapshot(turn, Math.round(amount));
    return { recorded: true, skipped: false };
  }
}
