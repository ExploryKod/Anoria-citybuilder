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
   */
  async appendEntry(entry, options = {}) {
    await this.journalManager.addJournalEntry(
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
  }

  /** @inheritdoc */
  async upsertBalanceSnapshot(turn, amount) {
    await this.journalManager.addBalanceEntry(turn, amount);
  }
}
