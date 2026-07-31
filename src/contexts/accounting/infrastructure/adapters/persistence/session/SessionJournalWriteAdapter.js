import { JournalWritePort } from '../../../../application/ports/JournalWritePort.js';
import { sessionLedgerBuffer } from '../../../../../../js/stores/SessionLedgerBuffer.js';

/**
 * Writes through the session journal buffer (same path as JournalManager).
 */
export class SessionJournalWriteAdapter extends JournalWritePort {
  /**
   * @param {import('../../../../../../js/stores/JournalManager.js').JournalManager} journalManager
   */
  constructor(journalManager) {
    super();
    this.journalManager = journalManager;
  }

  /** @param {string} businessKey */
  async hasBusinessKey(businessKey) {
    await this.journalManager.ensureHydrated();
    return sessionLedgerBuffer.hasBusinessKey(businessKey);
  }

  /**
   * @param {object} entry
   * @param {{ persist?: boolean }} [options]
   * @returns {Promise<{ recorded: boolean, skipped?: boolean, reason?: string }>}
   */
  async appendEntry(entry, options = {}) {
    const result = await this.journalManager.addJournalEntry(
      entry.turn,
      entry.type,
      entry.amount,
      entry.description,
      entry.partnerId ?? null,
      {
        businessKey: entry.businessKey ?? null,
        buildingInstanceId: entry.buildingInstanceId ?? null,
        persist: options.persist,
      }
    );

    if (result?.skipped) {
      return { recorded: false, skipped: true, reason: result.reason };
    }

    return { recorded: true, skipped: false };
  }

  /** @inheritdoc */
  async upsertBalanceSnapshot(turn, amount) {
    await this.journalManager.addBalanceEntry(turn, amount);
  }
}
