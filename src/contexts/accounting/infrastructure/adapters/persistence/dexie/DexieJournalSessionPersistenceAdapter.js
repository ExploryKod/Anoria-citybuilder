import {
  sessionLedgerBuffer,
  toDexieRow,
} from '../../../../../../js/stores/SessionLedgerBuffer.js';
import { JournalSessionPersistencePort } from '../../../../application/ports/JournalSessionPersistencePort.js';
import db from '../../../../../../core/persistence/dexie/db.js';

/**
 * Flushes SessionLedgerBuffer pending rows into Dexie `journal` table.
 */
export class DexieJournalSessionPersistenceAdapter extends JournalSessionPersistencePort {
  /** @param {import('dexie').Dexie} [dexieDb] */
  constructor(dexieDb = db) {
    super();
    this.db = dexieDb;
  }

  /** @returns {Promise<void>} */
  async ensureHydrated() {
    if (sessionLedgerBuffer.isHydrated()) {
      return;
    }

    const idbEntries = await this.db.journal.toArray();
    if (idbEntries.length > 0) {
      sessionLedgerBuffer.hydrateFromIdb(idbEntries);
    } else {
      sessionLedgerBuffer.markHydratedEmpty();
    }
  }

  /** @inheritdoc */
  async flushPendingEntries() {
    await this.ensureHydrated();
    const pending = sessionLedgerBuffer.getPendingPersist();
    if (pending.length === 0) {
      return { flushed: 0, failed: false };
    }

    try {
      await this.db.transaction('rw', this.db.journal, async () => {
        for (const entry of pending) {
          const id = await this.db.journal.add(toDexieRow(entry));
          sessionLedgerBuffer.markPersisted([{ sessionId: entry.sessionId, id }]);
        }
      });
      return { flushed: pending.length, failed: false };
    } catch (error) {
      console.error('[DexieJournalSessionPersistenceAdapter] flush failed:', error);
      return {
        flushed: 0,
        failed: true,
        pending: pending.length,
      };
    }
  }
}
