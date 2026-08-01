import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';

/**
 * Command: collect surplus from all farms for one windmill (December).
 * Applies UI flags, lastCollection, and farm sales history.
 */
export class ProcessWindmillCollection {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./WindmillCollectsFromAllFarms.js').WindmillCollectsFromAllFarms} windmillCollectsFromAllFarms
   * @param {import('./SetWindmillCollectingFlag.js').SetWindmillCollectingFlag} setWindmillCollectingFlag
   * @param {import('./MarkFarmSoldToWindmill.js').MarkFarmSoldToWindmill} markFarmSoldToWindmill
   */
  constructor(
    supplyBuildingRepository,
    windmillCollectsFromAllFarms,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.windmillCollectsFromAllFarms = windmillCollectsFromAllFarms;
    this.setWindmillCollectingFlag = setWindmillCollectingFlag;
    this.markFarmSoldToWindmill = markFarmSoldToWindmill;
  }

  /**
   * @param {object} params
   * @param {string} params.windmillId
   * @param {object[]} params.farmRefs
   * @param {string} params.month
   * @param {number} params.year
   * @returns {Promise<{
   *   processed: boolean,
   *   collected: boolean,
   *   reason?: string,
   *   windmillId?: string,
   *   totalBaskets?: number,
   *   transfers?: object[],
   * }>}
   */
  async execute({ windmillId, farmRefs = [], month, year }) {
    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    if (!windmill) {
      return { processed: false, collected: false, reason: 'windmill_not_found' };
    }

    if (
      !isOperational({
        roadCount: windmill.roadCount,
        worker: windmill.worker,
        workerNeed: windmill.workerNeed,
      })
    ) {
      await this.setWindmillCollectingFlag.execute({
        windmillId,
        isCollecting: false,
      });
      return {
        processed: true,
        collected: false,
        reason: 'windmill_not_operational',
        windmillId,
      };
    }

    await this.setWindmillCollectingFlag.execute({
      windmillId,
      isCollecting: true,
    });

    const outcome = await this.windmillCollectsFromAllFarms.execute({
      windmillId,
      farmRefs,
      month,
    });

    if (!outcome.collected) {
      if (outcome.reason === 'windmill_not_operational') {
        await this.setWindmillCollectingFlag.execute({
          windmillId,
          isCollecting: false,
        });
      }

      await this.supplyBuildingRepository.saveWindmillLastCollection(windmillId, {
        wheat: 0,
        carrot: 0,
        cabbage: 0,
        total: 0,
      });

      return {
        processed: true,
        collected: false,
        reason: outcome.reason,
        windmillId,
      };
    }

    const harvestYear = Number.isFinite(year) ? Math.floor(year) : 0;
    const lastCollection = {
      wheat: 0,
      carrot: 0,
      cabbage: 0,
      total: outcome.totalBaskets,
    };

    for (const transfer of outcome.transfers) {
      if (transfer.crop === 'wheat' || transfer.crop === 'cabbage') {
        await this.markFarmSoldToWindmill.execute({
          farmId: transfer.farmId,
          soldToWindmill: true,
        });
      }

      if (lastCollection[transfer.crop] != null) {
        lastCollection[transfer.crop] += transfer.amount;
      }

      await this.supplyBuildingRepository.recordFarmSaleToWindmill(transfer.farmId, {
        year: harvestYear,
        productType: transfer.crop,
        quantity: transfer.amount,
        windmillId,
      });
    }

    await this.supplyBuildingRepository.saveWindmillLastCollection(
      windmillId,
      lastCollection
    );

    return {
      processed: true,
      collected: true,
      windmillId,
      totalBaskets: outcome.totalBaskets,
      transfers: outcome.transfers,
    };
  }
}
