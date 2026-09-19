import { buildWorldMapView } from '../contexts/geography/application/queries/buildWorldMapView.js';
import {
  canTravelToHamlet,
} from '../core/persistence/hamlet/hamletAccess.js';
import {
  getActiveHamletId,
  setActiveHamletId,
} from '../core/persistence/hamlet/hamletSession.js';

/**
 * @param {object} [_deps]
 */
export function createMapSessionApi(_deps = {}) {
  return Object.freeze({
    async getWorldMapView() {
      return buildWorldMapView();
    },

    async travelToHamlet(hamletId) {
      if (hamletId === getActiveHamletId()) {
        return { success: true, alreadyActive: true };
      }

      if (!(await canTravelToHamlet(hamletId))) {
        return { success: false, reason: 'locked' };
      }

      setActiveHamletId(hamletId);
      return { success: true, alreadyActive: false };
    },
  });
}
