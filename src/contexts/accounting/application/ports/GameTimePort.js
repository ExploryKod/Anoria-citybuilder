/**
 * Port: resolve game calendar from turn number.
 */
export class GameTimePort {
  /**
   * @param {number} turn
   * @returns {{ year: number, month?: string, monthIndex?: number }}
   */
  getTimeInfo(_turn) {
    throw new Error('GameTimePort: port not implemented');
  }
}
