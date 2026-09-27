import { buildWorldMapView } from '../contexts/geography/application/queries/buildWorldMapView.js';
import {
  canTravelToHamlet,
} from '../core/persistence/hamlet/hamletAccess.js';
import {
  getActiveHamletId,
  setActiveHamletId,
} from '../core/persistence/hamlet/hamletSession.js';

/**
 * @param {object} [deps]
 * @param {{ getCityTradeInfo: (cityId: string) => Promise<object> }} [deps.trade]
 */
export function createMapSessionApi(deps = {}) {
  const { trade } = deps;

  return Object.freeze({
    async getWorldMapView() {
      return buildWorldMapView();
    },

    /**
     * Trade relation + full sale history for a city.
     * Returns null for cities with no trade catalog entry.
     * @param {string} cityId
     */
    async getCityTradeInfo(cityId) {
      if (!trade) return null;
      return trade.getCityTradeInfo(cityId);
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
