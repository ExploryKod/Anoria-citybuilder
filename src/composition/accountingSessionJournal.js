/**
 * ACL — session journal infrastructure (Accounting BC).
 */
export {
  SessionJournalStore,
  resetSessionJournalStoreForTests,
} from '../contexts/accounting/infrastructure/session/SessionJournalStore.js';

export { default as sessionJournalStore } from '../contexts/accounting/infrastructure/session/SessionJournalStore.js';

export {
  SessionLedgerBuffer,
  sessionLedgerBuffer,
  toPublicEntry,
  toDexieRow,
  resetSessionLedgerBufferForTests,
} from '../contexts/accounting/infrastructure/session/SessionLedgerBuffer.js';

import { SessionJournalStore } from '../contexts/accounting/infrastructure/session/SessionJournalStore.js';
import sessionJournalStore from '../contexts/accounting/infrastructure/session/SessionJournalStore.js';
import { getTimeManager } from './sessionShell.js';

function createFallbackGameTimePort() {
  return {
    getTimeInfo: (turn) => {
      const timeManager = getTimeManager();
      if (!timeManager || typeof timeManager.getTimeInfo !== 'function') {
        return null;
      }
      return timeManager.getTimeInfo(turn);
    },
  };
}

/** Backward-compatible alias for tests and legacy callers. */
export class JournalManager extends SessionJournalStore {
  constructor(deps = {}) {
    super({
      ...deps,
      gameTimePort: deps.gameTimePort ?? createFallbackGameTimePort(),
    });
  }
}

export default sessionJournalStore;
