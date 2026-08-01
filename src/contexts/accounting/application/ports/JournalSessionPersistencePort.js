/**
 * Port — persist pending session journal entries to IndexedDB.
 */
export class JournalSessionPersistencePort {
  /** @returns {Promise<{ flushed: number, failed: boolean, pending?: number }>} */
  async flushPendingEntries() {
    throw new Error('JournalSessionPersistencePort: port not implemented');
  }
}
