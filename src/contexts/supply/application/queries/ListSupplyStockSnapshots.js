import { classifySupplyKind } from './GetBuildingSupplyView.js';
import { createSupplyStock } from '../../domain/value-objects/SupplyStock.js';

/**
 * Query: all buildings with Supply stocks (+ layout/pop) for admin food-traceability.
 * Replaces raw Dexie stock peeks in FoodTraceabilityPanel (via Supply BC).
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
      stocks: createSupplyStock(view.stocks),
      pop: view.pop || 0,
    }));
  }
}
