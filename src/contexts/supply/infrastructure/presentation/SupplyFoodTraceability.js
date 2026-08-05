/**
 * Side-effect adapter — records food chain movements in the traceability log.
 */
export class SupplyFoodTraceability {
  /**
   * @param {object} deps
   * @param {import('../dexie/DexieFoodTraceabilityRepository.js').DexieFoodTraceabilityRepository} deps.foodTraceabilityRepository
   * @param {import('../../application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} deps.supplyBuildingRepository
   */
  constructor({ foodTraceabilityRepository, supplyBuildingRepository }) {
    this.foodTraceabilityRepository = foodTraceabilityRepository;
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} timeInfo
   * @param {string} marketId
   * @param {object[]} transfers
   */
  async recordWindmillToMarketTransfers(timeInfo, marketId, transfers = []) {
    if (transfers.length === 0) return;

    const marketData = await this.supplyBuildingRepository.findRowById(marketId);
    if (!marketData) return;

    for (const transfer of transfers) {
      const windmillData = await this.supplyBuildingRepository.findRowById(transfer.windmillId);
      if (!windmillData) continue;

      await this.foodTraceabilityRepository.recordFarmToMarket(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: transfer.windmillId,
          x: windmillData.x,
          y: windmillData.y,
          type: windmillData.type,
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
  async recordFarmToMarketTransfers(timeInfo, marketId, transfers = []) {
    if (transfers.length === 0) return;

    const marketData = await this.supplyBuildingRepository.findRowById(marketId);
    if (!marketData) return;

    for (const transfer of transfers) {
      const farmData = await this.supplyBuildingRepository.findRowById(transfer.farmId);
      if (!farmData) continue;

      await this.foodTraceabilityRepository.recordFarmToMarket(
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
    if (transfers.length === 0) return;

    const marketData = await this.supplyBuildingRepository.findRowById(marketId);
    if (!marketData) return;

    for (const transfer of transfers) {
      const houseData = await this.supplyBuildingRepository.findRowById(transfer.houseId);
      if (!houseData) continue;

      await this.foodTraceabilityRepository.recordMarketToHouse(
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
    if (consumptions.length === 0) return;

    for (const entry of consumptions) {
      const houseData = await this.supplyBuildingRepository.findRowById(entry.houseId);
      if (!houseData) continue;

      const houseRef = {
        id: entry.houseId,
        x: houseData.x,
        y: houseData.y,
        type: houseData.type,
      };
      const crops = entry.crops || entry.consumedByCategory || {};

      for (const foodType of ['fruit', 'game', 'wheat', 'carrot', 'cabbage']) {
        const amount = crops[foodType] || 0;
        if (amount <= 0) continue;

        await this.foodTraceabilityRepository.recordHouseConsumption(
          timeInfo.turn || 0,
          timeInfo.monthIndex,
          timeInfo.year || 0,
          houseRef,
          foodType,
          amount,
          entry.pop
        );
      }
    }
  }
}
