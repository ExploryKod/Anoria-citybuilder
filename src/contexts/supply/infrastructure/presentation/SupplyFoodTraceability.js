import db from '../../../../core/persistence/dexie/db.js';

/**
 * Legacy food traceability side-effects (window.foodTraceabilityService).
 */
export class SupplyFoodTraceability {
  get #service() {
    if (typeof globalThis !== 'undefined' && globalThis.foodTraceabilityService) {
      return globalThis.foodTraceabilityService;
    }
    if (typeof window !== 'undefined' && window.foodTraceabilityService) {
      return window.foodTraceabilityService;
    }
    return null;
  }

  /**
   * @param {object} timeInfo
   * @param {string} marketId
   * @param {object[]} transfers
   */
  async recordFarmToMarketTransfers(timeInfo, marketId, transfers = []) {
    const service = this.#service;
    if (!service || transfers.length === 0) return;

    const marketData = await db.houses.get(marketId);
    if (!marketData) return;

    for (const transfer of transfers) {
      const farmData = await db.houses.get(transfer.farmId);
      if (!farmData) continue;

      await service.recordFarmToMarket(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: transfer.farmId,
          x: farmData.x,
          y: farmData.y,
          type: farmData.type,
        },
        {
          id: marketId,
          x: marketData.x,
          y: marketData.y,
          type: marketData.type,
        },
        transfer.crop,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {string} marketId
   * @param {object[]} transfers
   */
  async recordMarketToHouseTransfers(timeInfo, marketId, transfers = []) {
    const service = this.#service;
    if (!service || transfers.length === 0) return;

    const marketData = await db.houses.get(marketId);
    if (!marketData) return;

    for (const transfer of transfers) {
      const houseData = await db.houses.get(transfer.houseId);
      if (!houseData) continue;

      await service.recordMarketToHouse(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: marketId,
          x: marketData.x,
          y: marketData.y,
          type: marketData.type,
        },
        {
          id: transfer.houseId,
          x: houseData.x,
          y: houseData.y,
          type: houseData.type,
        },
        transfer.crop,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {object[]} consumptions
   */
  async recordHouseConsumptions(timeInfo, consumptions = []) {
    const service = this.#service;
    if (!service || consumptions.length === 0) return;

    for (const entry of consumptions) {
      const houseData = await db.houses.get(entry.houseId);
      if (!houseData) continue;

      const houseRef = {
        id: entry.houseId,
        x: houseData.x,
        y: houseData.y,
        type: houseData.type,
      };
      const crops = entry.crops || {};

      for (const crop of ['wheat', 'carrot', 'cabbage']) {
        const amount = crops[crop] || 0;
        if (amount <= 0) continue;

        await service.recordHouseConsumption(
          timeInfo.turn || 0,
          timeInfo.monthIndex,
          timeInfo.year || 0,
          houseRef,
          crop,
          amount,
          entry.pop
        );
      }
    }
  }
}
