/**
 * One-shot process boot: TimeManager cache + core ACL services + time bridge.
 */

import { TimeManager } from '../shared/time/TimeManager.js';
import { registerGetTimeInfo } from './gameTimeBridge.js';
import { registerCoreRuntimeServices } from './registerCoreRuntimeServices.js';

let bootstrapped = false;

export function ensureGameRuntimeBootstrapped() {
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

  TimeManager.initializeCache().catch((err) => {
    console.warn('[Game] Could not initialize TimeManager cache:', err);
  });

  registerCoreRuntimeServices();
  registerGetTimeInfo((turn) => TimeManager.getTimeInfo(turn));
}

/** @internal Tests only */
export function resetGameRuntimeBootstrapForTests() {
  bootstrapped = false;
}
