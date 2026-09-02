/**
 * Command: a building consumes resource units for its population (once per
 * period). Resource-agnostic — the demand/consumption math and repository
 * bookkeeping come entirely from the `circuit` descriptor (see
 * domain/catalogs/FoodCircuits.js for the house food consumer).
 */
export class ConsumeResource {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.buildingId
   * @param {object} params.period
   * @param {object} params.circuit
   * @returns {Promise<{
   *   consumed: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   pop?: number,
   *   demand?: number,
   *   unfed?: number,
   *   consumedByCategory?: Record<string, number>,
   * }>}
   */
  async execute({ buildingId, period, circuit }) {
    const building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { consumed: false, reason: 'building_not_found' };
    }

    const periodKey = circuit.periodKey(period);
    if (building[circuit.lastConsumedField] === periodKey) {
      return { consumed: false, reason: 'already_consumed_this_period' };
    }

    const pop = Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0;
    if (pop <= 0) {
      return { consumed: false, reason: 'no_population' };
    }

    const level = building.level ?? 1;
    const { nextStock, consumed, demanded, unfed, totalUnfed } = circuit.applyConsumption({
      stock: building.stocks,
      population: pop,
      level,
    });

    await this.supplyBuildingRepository.saveStocks(buildingId, nextStock);
    await circuit.saveConsumptionMetadata(this.supplyBuildingRepository, buildingId, periodKey, period, {
      consumed,
      demanded,
      unfed,
      totalUnfed,
    });

    return {
      consumed: true,
      buildingId,
      pop,
      demand: Object.values(demanded).reduce((sum, qty) => sum + qty, 0),
      unfed: totalUnfed,
      consumedByCategory: consumed,
    };
  }
}
