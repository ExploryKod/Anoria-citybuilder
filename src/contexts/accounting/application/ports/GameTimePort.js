/**
 * Port: the game's calendar and clock. The calendar resolves a turn into a date; the clock is the current turn.
 */
export class GameTimePort {
  /**
   * @param {number} turn
   * @returns {{ year: number, month?: string, monthIndex?: number }}
   */
  getTimeInfo(_turn) {
    throw new Error('GameTimePort: port not implemented');
  }

  /** @returns {number} The turn the running game is on. */
  currentTurn() {
    throw new Error('GameTimePort: port not implemented');
  }
}
