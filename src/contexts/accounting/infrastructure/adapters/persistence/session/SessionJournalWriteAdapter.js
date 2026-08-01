import { JournalWritePort } from '../../../../application/ports/JournalWritePort.js';
import { sessionLedgerBuffer } from '../../../session/SessionLedgerBuffer.js';

/**
 * Writes through the session journal buffer (SessionJournalStore).
 */
export class SessionJournalWriteAdapter extends JournalWritePort {
  /**
   * @param {import('../../../session/SessionJournalStore.js').SessionJournalStore} sessionJournalStore
   */
  constructor(sessionJournalStore) {
    super();
    this.sessionJournalStore = sessionJournalStore;
  }

  /** @param {string} businessKey */
  async hasBusinessKey(businessKey) {
    await this.sessionJournalStore.ensureHydrated();
    return sessionLedgerBuffer.hasBusinessKey(businessKey);
  }

  /**
   * @param {object} entry
   * @param {{ persist?: boolean }} [options]
   * @returns {Promise<{ recorded: boolean, skipped?: boolean, reason?: string }>}
   */
  async appendEntry(entry, options = {}) {
    const result = await this.sessionJournalStore.addJournalEntry(
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
    await this.sessionJournalStore.addBalanceEntry(turn, amount);
  }
}
