/**
 * In-memory journal buffer — authoritative ledger during an active game session.
 *
 * IndexedDB receives batched checkpoints via FlushJournalSession / SessionJournalStore.
 * Entries with persist=false (e.g. balance snapshots) stay session-only but remain
 * readable for export/UI.
 */

import { inferBusinessKeyFromRow } from '../../domain/policies/LedgerBusinessKeys.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

let nextSessionId = 1;

/** @typedef {object} SessionLedgerRecord
 * @property {number} sessionId
 * @property {boolean} persisted
 * @property {boolean} persist
 */

export class SessionLedgerBuffer {
  /** @type {Array<SessionLedgerRecord & object>} */
  #entries = [];
  #hydrated = false;
  /** @type {() => string} */
  #getHamletId;

  /** @param {{ getHamletId?: () => string }} [options] */
  constructor({ getHamletId = requireActiveHamletId } = {}) {
    this.#getHamletId = getHamletId;
  }

  reset() {
    this.#entries = [];
    this.#hydrated = false;
    nextSessionId = 1;
  }

  isHydrated() {
    return this.#hydrated;
  }

  /**
   * Load existing IndexedDB rows once per session (save load or first read).
   * @param {Array<object>} idbEntries
   */
  hydrateFromIdb(idbEntries) {
    this.reset();
    for (const row of idbEntries) {
      const businessKey = inferBusinessKeyFromRow(row);
      this.#entries.push({
        ...row,
        ...(businessKey ? { businessKey } : {}),
        sessionId: nextSessionId++,
        persisted: true,
        persist: true,
      });
    }
    this.#hydrated = true;
  }

  /** Mark hydrated when starting a fresh game with no persisted journal rows. */
  markHydratedEmpty() {
    this.#hydrated = true;
  }

  /** @param {string} businessKey */
  hasBusinessKey(businessKey) {
    if (!businessKey) {
      return false;
    }
    return this.#entries.some((entry) => entry.businessKey === businessKey);
  }

  /**
   * Atomically append if businessKey is not already present.
   * @param {object} entry
   * @param {{ persist?: boolean }} [options]
   * @returns {{ appended: boolean, reason?: string, record?: SessionLedgerRecord & object }}
   */
  appendIfAbsent(entry, { persist = true } = {}) {
    const businessKey = entry.businessKey;
    if (businessKey && this.hasBusinessKey(businessKey)) {
      return { appended: false, reason: 'duplicate_business_key' };
    }

    const record = this.append(entry, { persist });
    return { appended: true, record };
  }

  /**
   * @param {object} entry
   * @param {{ persist?: boolean }} [options]
   * @returns {SessionLedgerRecord & object}
   */
  append(entry, { persist = true } = {}) {
    const record = {
      ...entry,
      hamletId: entry.hamletId ?? this.#getHamletId(),
      sessionId: nextSessionId++,
      persisted: false,
      persist,
    };
    this.#entries.push(record);
    return record;
  }

  /**
   * @param {number} sessionId
   * @param {object} patch
   */
  updateBySessionId(sessionId, patch) {
    const index = this.#entries.findIndex((entry) => entry.sessionId === sessionId);
    if (index >= 0) {
      this.#entries[index] = { ...this.#entries[index], ...patch };
    }
  }

  /** @returns {Array<object>} Public entries (no session metadata). */
  getAllPublic() {
    return this.#entries.map(toPublicEntry);
  }

  /** @param {number} turn */
  getForTurn(turn) {
    return this.#entries
      .filter((entry) => entry.turn === turn)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(toPublicEntry);
  }

  /** @returns {Array<SessionLedgerRecord & object>} */
  getPendingPersist() {
    return this.#entries.filter((entry) => entry.persist && !entry.persisted);
  }

  /**
   * @param {Array<{ sessionId: number, id: number }>} pairs
   */
  markPersisted(pairs) {
    for (const { sessionId, id } of pairs) {
      const index = this.#entries.findIndex((entry) => entry.sessionId === sessionId);
      if (index >= 0) {
        this.#entries[index] = { ...this.#entries[index], id, persisted: true };
      }
    }
  }

  /**
   * The fiscal year stamped on an entry when it was written. Throws when missing: a purge must never guess.
   * @param {object} entry
   * @returns {number}
   */
  static fiscalYearOf(entry) {
    if (typeof entry.year !== 'number') {
      throw new Error(`[journal] entry ${entry.id ?? entry.type} (turn ${entry.turn}) has no fiscal year stamp`);
    }
    return entry.year;
  }

  /** @returns {number|null} The most recent stamped fiscal year in the buffer, null when empty. */
  latestFiscalYear() {
    let latest = null;
    for (const entry of this.#entries) {
      const year = SessionLedgerBuffer.fiscalYearOf(entry);
      if (latest === null || year > latest) latest = year;
    }
    return latest;
  }

  /**
   * The records of the years strictly before `cutoffYear` that `isFolded` accepts, with their session metadata.
   * @param {number} cutoffYear
   * @param {(entry: object) => boolean} isFolded
   * @returns {Array<SessionLedgerRecord & object>}
   */
  recordsFoldedBeforeYear(cutoffYear, isFolded) {
    return this.#entries.filter(
      (entry) => SessionLedgerBuffer.fiscalYearOf(entry) < cutoffYear && isFolded(entry)
    );
  }

  /** @param {Set<number>} sessionIds */
  removeSessionIds(sessionIds) {
    this.#entries = this.#entries.filter((entry) => !sessionIds.has(entry.sessionId));
  }

  /**
   * Add a line that is already on disk (its id is known).
   * @param {object} entry
   * @param {number} id
   * @returns {SessionLedgerRecord & object}
   */
  appendPersisted(entry, id) {
    const record = { ...entry, id, sessionId: nextSessionId++, persisted: true, persist: true };
    this.#entries.push(record);
    return record;
  }

  /** @returns {number} */
  clear() {
    const count = this.#entries.length;
    this.reset();
    return count;
  }
}

/** @param {SessionLedgerRecord & object} entry */
export function toPublicEntry(entry) {
  const { sessionId, persisted, persist, ...publicFields } = entry;
  return publicFields;
}

/** @param {SessionLedgerRecord & object} entry */
export function toDexieRow(entry) {
  const { sessionId, persisted, persist, ...row } = entry;
  return row;
}

export const sessionLedgerBuffer = new SessionLedgerBuffer();

/** @internal Tests */
export function resetSessionLedgerBufferForTests() {
  sessionLedgerBuffer.reset();
}
