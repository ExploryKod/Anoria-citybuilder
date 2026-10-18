/**
 * Port: append operational lines to the session journal buffer.
 */
export class JournalWritePort {
  /** @param {string} _businessKey */
  async hasBusinessKey(_businessKey) {
    throw new Error('JournalWritePort: port not implemented');
  }

  /**
   * @param {object} _entry
   * @param {{ persist?: boolean }} [_options]
   */
  async appendEntry(_entry, _options = {}) {
    throw new Error('JournalWritePort: port not implemented');
  }

  /**
   * Writes everything `work` appends in one go (see SessionJournalStore.batch): the lines are in the journal as soon as they are appended, and on disk together
   * when `work` is done; if `work` or the write fails, none of them is kept.
   * @template T
   * @param {() => Promise<T>} _work
   * @returns {Promise<T>}
   */
  async batch(_work) {
    throw new Error('JournalWritePort: port not implemented');
  }

  /**
   * Session-only treasury snapshot per turn (upsert, not append).
   * @param {number} _turn
   * @param {number} _amount
   */
}
