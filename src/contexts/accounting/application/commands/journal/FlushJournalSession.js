/**
 * Batch-write pending session journal entries to IndexedDB.
 */
export class FlushJournalSession {
  /**
   * @param {import('../../ports/JournalSessionPersistencePort.js').JournalSessionPersistencePort} journalSessionPersistencePort
   */
  constructor(journalSessionPersistencePort) {
    this.journalSessionPersistencePort = journalSessionPersistencePort;
  }

  /** @returns {Promise<{ flushed: number, failed: boolean, pending?: number }>} */
  async execute() {
    return this.journalSessionPersistencePort.flushPendingEntries();
  }
}
