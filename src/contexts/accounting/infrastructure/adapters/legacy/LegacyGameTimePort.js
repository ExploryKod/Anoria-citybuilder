import { GameTimePort } from '../../../application/ports/GameTimePort.js';

/**
 * Phase 1 adapter — delegates to TimeManager (browser or injected).
 */
export class LegacyGameTimePort extends GameTimePort {
  /** @param {{ getTimeInfo: (turn: number) => object }|null} timeManager */
  constructor(timeManager) {
    super();
    this.timeManager = timeManager;
  }

  getTimeInfo(turn) {
    if (!this.timeManager) {
      throw new Error('LegacyGameTimePort: no timeManager bound, cannot resolve the time of a turn');
    }
    return this.timeManager.getTimeInfo(turn);
  }
}
