import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { addCategoryAmount } from '../../../domain/value-objects/ResourceStock.js';

/**
 * Command: a building produces resource units into its own stock, gated by
 * a circuit's production window (season/period) and a once-per-period lock.
 * Resource-agnostic — behavior comes entirely from the `circuit` descriptor
 * (see domain/catalogs/FoodCircuits.js for the food producers).
 */
export class ProduceResource {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.buildingId
   * @param {object} params.period - time context passed to the circuit's gates (season, month, year, monthIndex, ...)
   * @param {object} params.circuit - circuit descriptor (see FoodCircuits.js)
   * @returns {Promise<{
   *   produced: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   category?: string,
   *   amount?: number,
   * }>}
   */
  async execute({ buildingId, period, circuit }) {
    if (!circuit.canProduce(period)) {
      return { produced: false, reason: 'not_production_period' };
    }

    const building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { produced: false, reason: 'building_not_found' };
    }

    if (
      !isOperational({
        roadCount: building.roadCount,
        worker: building.worker,
        workerNeed: building.workerNeed,
      })
    ) {
      return { produced: false, reason: 'not_operational' };
    }

    const periodKey = circuit.periodKey(period);
    if (building[circuit.lastProducedField] === periodKey) {
      return { produced: false, reason: 'already_produced_this_period' };
    }

    const category = circuit.resourceCategoryForBuilding(building.type);
    if (!category) {
      return { produced: false, reason: 'unknown_resource_category' };
    }

    const amount = circuit.yieldAmount();
    const nextStock = addCategoryAmount(building.stocks, category, amount, circuit.categories, circuit.totalKey);
    await this.supplyBuildingRepository.saveStocks(buildingId, nextStock);
    await circuit.saveProductionMetadata(this.supplyBuildingRepository, buildingId, period);

    return { produced: true, buildingId, category, amount };
  }
}
