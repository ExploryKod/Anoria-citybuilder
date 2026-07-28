import { classifySupplyKind } from './GetBuildingSupplyView.js';

/**
 * Query: all buildings with Supply stocks (+ layout/pop) for admin food-traceability.
 * Replaces raw housesStore.listAllHouses() stock peeks in FoodTraceabilityManager.
 */
export class ListSupplyStockSnapshots {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @returns {Promise<Array<{
   *   id: string,
   *   name: string,
   *   type: string,
   *   x: number | null,
   *   y: number | null,
   *   kind: string,
   *   stocks: object,
   *   pop: number,
   * }>>}
   */
  async execute() {
    const views = await this.supplyBuildingRepository.listAllSupplyViews();
    return views.map((view) => ({
      id: view.id,
      name: view.id,
      type: view.type,
      x: view.x,
      y: view.y,
      kind: classifySupplyKind(view.type),
      stocks: {
        wheat: view.stocks?.wheat || 0,
        carrot: view.stocks?.carrot || 0,
        cabbage: view.stocks?.cabbage || 0,
        food: view.stocks?.food || 0,
        dattes: view.stocks?.dattes || 0,
        wood: view.stocks?.wood || 0,
      },
      pop: view.pop || 0,
    }));
  }
}
