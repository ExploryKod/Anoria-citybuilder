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
      return { year: 0 };
    }
    return this.timeManager.getTimeInfo(turn);
  }
}
