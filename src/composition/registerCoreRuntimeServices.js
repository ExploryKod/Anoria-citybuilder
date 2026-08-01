import { registerAppService } from '../js/acl/appRuntime.js';
import { TimeManager } from '../shared/time/TimeManager.js';

/** Registers cross-cutting runtime services used by ACL getters and legacy UI. */
export function registerCoreRuntimeServices() {
  registerAppService('timeManager', TimeManager);
}
