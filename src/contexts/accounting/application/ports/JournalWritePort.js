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
   * Session-only treasury snapshot per turn (upsert, not append).
   * @param {number} _turn
   * @param {number} _amount
   */
  async upsertBalanceSnapshot(_turn, _amount) {
    throw new Error('JournalWritePort: port not implemented');
  }
}
