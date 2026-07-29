import { canFarmHarvest } from '../../../domain/policies/HarvestSeasonPolicy.js';
import { annualFarmYield } from '../../../domain/policies/FarmYieldPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { cropFromFarmType } from '../../../domain/value-objects/CropType.js';
import { addCrop } from '../../../domain/value-objects/FoodStock.js';

/**
 * Command: farm adds its annual crop harvest to stock (autumn, once per year).
 */
export class HarvestFarmCrop {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.farmId
   * @param {string} params.season
   * @param {number} params.year
   * @param {number} [params.monthIndex]
   * @returns {Promise<{
   *   harvested: boolean,
   *   reason?: string,
   *   farmId?: string,
   *   crop?: string,
   *   amount?: number,
   * }>}
   */
  async execute({ farmId, season, year, monthIndex = null }) {
    if (!canFarmHarvest(season)) {
      return { harvested: false, reason: 'not_harvest_season' };
    }

    const farm = await this.supplyBuildingRepository.findById(farmId);
    if (!farm) {
      return { harvested: false, reason: 'farm_not_found' };
    }

    if (
      !isOperational({
        roadCount: farm.roadCount,
        worker: farm.worker,
        workerNeed: farm.workerNeed,
      })
    ) {
      return { harvested: false, reason: 'farm_not_operational' };
    }

    const harvestYear = Number.isFinite(year) ? Math.floor(year) : 0;
    if (farm.lastProductionYear === harvestYear) {
      return { harvested: false, reason: 'already_harvested_this_year' };
    }

    const crop = cropFromFarmType(farm.type);
    if (!crop) {
      return { harvested: false, reason: 'unknown_farm_type' };
    }

    const amount = annualFarmYield();
    const nextStock = addCrop(farm.stocks, crop, amount);
    await this.supplyBuildingRepository.saveStocks(farmId, nextStock);
    await this.supplyBuildingRepository.saveHarvestMetadata(farmId, {
      lastProductionYear: harvestYear,
      lastProductionMonth: monthIndex,
    });

    return { harvested: true, farmId, crop, amount };
  }
}
