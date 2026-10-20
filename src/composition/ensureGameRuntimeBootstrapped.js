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

  registerCoreRuntimeServices();
  registerGetTimeInfo((turn) => TimeManager.getTimeInfo(turn));
}

/** @internal Tests only */
export function resetGameRuntimeBootstrapForTests() {
  bootstrapped = false;
}
