import { SimService } from './SimService.js';
import { ensureSectorPrioritiesInitialized } from '../../acl/employment.js';

/** Legacy game service — delegates sector priority init to Employment BC. */
export class EmploymentPriorityService extends SimService {
  async simulate(_city, _time = 0) {
    try {
      ensureSectorPrioritiesInitialized();
    } catch (error) {
      console.error('[EmploymentPriorityService] Error:', {
        error: error?.message || error,
        time: _time,
      });
    }
  }
}
