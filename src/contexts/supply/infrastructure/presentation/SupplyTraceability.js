import {
  getAnnualSupplyEntry,
  getResourceStockShape,
} from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';

/**
 * Side-effect adapter — records supply chain movements in the traceability log.
 */
export class SupplyTraceability {
  /**
   * @param {object} deps
   * @param {import('../dexie/DexieSupplyTraceabilityRepository.js').DexieSupplyTraceabilityRepository} deps.foodTraceabilityRepository
   * @param {import('../../application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} deps.supplyBuildingRepository
   */
  constructor({ foodTraceabilityRepository, supplyBuildingRepository }) {
    this.traceabilityRepository = foodTraceabilityRepository;
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} timeInfo
   * @param {string} distributorId
   * @param {object[]} transfers
   */
  async recordHubToDistributorTransfers(timeInfo, distributorId, transfers = []) {
    if (transfers.length === 0) return;

    const distributorData = await this.supplyBuildingRepository.findRowById(distributorId);
    if (!distributorData) return;

    for (const transfer of transfers) {
      const hubData = await this.supplyBuildingRepository.findRowById(transfer.hubId);
      if (!hubData) continue;

      await this.traceabilityRepository.recordSourceToDistributor(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: transfer.hubId,
          x: hubData.x,
          y: hubData.y,
          type: hubData.type,
        },
        {
          id: distributorId,
          x: distributorData.x,
          y: distributorData.y,
          type: distributorData.type,
        },
        transfer.category,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {string} distributorId
   * @param {object[]} transfers
   */
  async recordSourceToDistributorTransfers(timeInfo, distributorId, transfers = []) {
    if (transfers.length === 0) return;

    const distributorData = await this.supplyBuildingRepository.findRowById(distributorId);
    if (!distributorData) return;

    for (const transfer of transfers) {
      const sourceData = await this.supplyBuildingRepository.findRowById(transfer.sourceId);
      if (!sourceData) continue;

      await this.traceabilityRepository.recordSourceToDistributor(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: transfer.sourceId,
          x: sourceData.x,
          y: sourceData.y,
          type: sourceData.type,
        },
        {
          id: distributorId,
          x: distributorData.x,
          y: distributorData.y,
          type: distributorData.type,
        },
        transfer.category,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {string} distributorId
   * @param {object[]} transfers
   */
  async recordDistributorToConsumerTransfers(timeInfo, distributorId, transfers = []) {
    if (transfers.length === 0) return;

    const distributorData = await this.supplyBuildingRepository.findRowById(distributorId);
    if (!distributorData) return;

    for (const transfer of transfers) {
      const houseData = await this.supplyBuildingRepository.findRowById(transfer.houseId);
      if (!houseData) continue;

      await this.traceabilityRepository.recordDistributorToConsumer(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: distributorId,
          x: distributorData.x,
          y: distributorData.y,
          type: distributorData.type,
        },
        {
          id: transfer.houseId,
          x: houseData.x,
          y: houseData.y,
          type: houseData.type,
        },
        transfer.category,
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
      if (!(entry.taken > 0)) continue;

      const houseData = await this.supplyBuildingRepository.findRowById(entry.houseId);
      if (!houseData) continue;

      const houseRef = {
        id: entry.houseId,
        x: houseData.x,
        y: houseData.y,
        type: houseData.type,
      };

      await this.traceabilityRepository.recordHouseConsumption(
        timeInfo.turn || 0,
        timeInfo.monthIndex,
        timeInfo.year || 0,
        houseRef,
        getResourceStockShape().totalKey,
        entry.taken,
        entry.pop
      );
    }
  }

  /**
   * Logs whether each annual producer (a farm) can work on this monthly tick —
   * the state the traceability panel shows per month, faithful to the game:
   * a farm deleted later still shows as it was.
   * @param {object} timeInfo
   */
  async recordProducerStates(timeInfo) {
    const producers = await this.supplyBuildingRepository.findByResourceRole('producer');

    for (const building of producers) {
      const entry = getAnnualSupplyEntry(building.type);
      if (!entry) continue;

      await this.traceabilityRepository.recordProducerState(
        timeInfo.turn || 0,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        { id: building.id, x: building.x, y: building.y, type: building.type },
        entry.categories[0],
        isOperational({
          roadCount: building.roadCount,
          worker: building.worker,
          workerNeed: building.workerNeed,
        })
          ? 1
          : 0
      );
    }
  }

  /**
   * Logs each harvest a hub bought from a producer, on the turn of the sale.
   * @param {object} timeInfo
   * @param {Array<{ hubId?: string, transfers?: Array<{ sourceId: string, category: string, amount: number }> }>} hubResults
   */
  async recordHarvestSales(timeInfo, hubResults = []) {
    for (const hubResult of hubResults) {
      if (!hubResult?.transfers?.length) continue;
      const hubData = await this.supplyBuildingRepository.findRowById(hubResult.hubId);
      if (!hubData) continue;

      for (const transfer of hubResult.transfers) {
        const sourceData = await this.supplyBuildingRepository.findRowById(transfer.sourceId);
        if (!sourceData) continue;

        await this.traceabilityRepository.recordSourceToHub(
          timeInfo.turn || 0,
          timeInfo.monthIndex || 0,
          timeInfo.year || 0,
          { id: transfer.sourceId, x: sourceData.x, y: sourceData.y, type: sourceData.type },
          { id: hubResult.hubId, x: hubData.x, y: hubData.y, type: hubData.type },
          transfer.category,
          transfer.amount
        );
      }
    }
  }
}
