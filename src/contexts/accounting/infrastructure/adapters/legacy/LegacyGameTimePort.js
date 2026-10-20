import { GameTimePort } from '../../../application/ports/GameTimePort.js';

/**
 * Phase 1 adapter — the calendar is TimeManager's; the current turn is the running game's clock.
 */
export class LegacyGameTimePort extends GameTimePort {
  /**
   * @param {{
   *   getTimeInfo: (turn: number) => object,
   *   currentTurn: () => number,
   * }|null} clock
   */
  constructor(clock) {
    super();
    this.clock = clock;
  }

  getTimeInfo(turn) {
    if (!this.clock) {
      throw new Error('LegacyGameTimePort: no clock bound, cannot resolve the time of a turn');
    }
    return this.clock.getTimeInfo(turn);
  }

  currentTurn() {
    if (!this.clock) {
      throw new Error('LegacyGameTimePort: no clock bound, cannot read the current turn');
    }
    return this.clock.currentTurn();
  }
}
