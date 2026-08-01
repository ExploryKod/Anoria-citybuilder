import { TimeManager } from '../shared/time/TimeManager.js';
import { bindSessionRuntime } from './sessionRuntime.js';
import { registerAppService } from './appServices.js';

/** Registers cross-cutting runtime services on the session spine. */
export function registerCoreRuntimeServices() {
  bindSessionRuntime({ timeManager: TimeManager });
  registerAppService('timeManager', TimeManager);
}
