import { buildWorldMapView } from '../contexts/geography/application/queries/buildWorldMapView.js';

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
      if (!trade) throw new Error('[mapSessionApi] getCityTradeInfo needs the trade context: none was given');
      return trade.getCityTradeInfo(cityId);
    },
  });
}
