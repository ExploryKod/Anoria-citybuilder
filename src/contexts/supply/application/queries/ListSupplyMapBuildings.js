import { classifySupplyKind } from './GetBuildingSupplyView.js';

/**
 * Query: city-map cells with Supply fields (hasFood, marketTooFar) + layout helpers.
 */
export class ListSupplyMapBuildings {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @returns {Promise<Array<{
   *   id: string,
   *   type: string,
   *   x: number | null,
   *   y: number | null,
   *   kind: string,
   *   hasFood: boolean,
   *   marketTooFar: boolean,
   *   roadCount: number,
   *   neighbors: object[],
   *   pop: number,
   * }>>}
   */
  async execute() {
    const views = await this.supplyBuildingRepository.listAllSupplyViews();
    return views.map((view) => {
      const kind = classifySupplyKind(view.type);
      const stocks = view.stocks || {};
      const hasFood =
        (stocks.food || 0) > 0 ||
        (stocks.wheat || 0) > 0 ||
        (stocks.carrot || 0) > 0 ||
        (stocks.cabbage || 0) > 0;

      return {
        id: view.id,
        type: view.type,
        x: view.x,
        y: view.y,
        kind,
        hasFood,
        marketTooFar: kind === 'house' ? view.marketTooFar === true : false,
        roadCount: view.roadCount,
        neighbors: [...(view.neighbors || [])],
        pop: view.pop || 0,
      };
    });
  }
}
