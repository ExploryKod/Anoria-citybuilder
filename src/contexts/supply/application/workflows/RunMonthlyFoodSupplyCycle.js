import { FOOD_CIRCUIT } from '../../domain/catalogs/FoodCircuitCatalog.js';
import {
  MARKET_WINDMILL_TRANSFER_CIRCUIT,
  MARKET_DISTRIBUTE_CIRCUIT,
} from '../../domain/catalogs/FoodCircuits.js';

/**
 * Orchestration: full monthly food supply chain tick.
 */
export class RunMonthlyFoodSupplyCycle {
  /**
   * @param {import('../commands/harvest/HarvestAllFarmCrops.js').HarvestAllFarmCrops} harvestAllFarmCrops
   * @param {import('../commands/procurement/RunCityResourceCycle.js').RunCityResourceCycle} runCityResourceCycle
   * @param {import('../commands/distribution/UpdateHousesMarketReach.js').UpdateHousesMarketReach} updateHousesMarketReach
   * @param {import('../commands/surplus/RunWindmillSurplusCycle.js').RunWindmillSurplusCycle} runWindmillSurplusCycle
   * @param {import('../commands/consumption/ConsumeAllHouseFood.js').ConsumeAllHouseFood} consumeAllHouseFood
   * @param {import('../../infrastructure/presentation/SupplyFoodTraceability.js').SupplyFoodTraceability} traceability
   * @param {import('../commands/subsistence/ProduceAllHouseSubsistenceFood.js').ProduceAllHouseSubsistenceFood} [produceAllHouseSubsistenceFood]
   */
  constructor(
    harvestAllFarmCrops,
    runCityResourceCycle,
    updateHousesMarketReach,
    runWindmillSurplusCycle,
    consumeAllHouseFood,
    traceability,
    produceAllHouseSubsistenceFood
  ) {
    this.harvestAllFarmCrops = harvestAllFarmCrops;
    this.runCityResourceCycle = runCityResourceCycle;
    this.updateHousesMarketReach = updateHousesMarketReach;
    this.runWindmillSurplusCycle = runWindmillSurplusCycle;
    this.consumeAllHouseFood = consumeAllHouseFood;
    this.traceability = traceability;
    this.produceAllHouseSubsistenceFood = produceAllHouseSubsistenceFood;
  }

  /**
   * @param {object} params
   * @param {string | null} params.season
   * @param {string | null} params.month
   * @param {object} params.timeInfo
   * @param {number} [params.maxDistance=5]
   * @returns {Promise<void>}
   */
  async execute({ season, month, timeInfo, maxDistance = 5 }) {
    if (season === 'autumn') {
      await this.harvestAllFarmCrops.execute({
        season,
        year: timeInfo.year ?? 0,
        monthIndex: timeInfo.monthIndex,
      });
    }

    await this.runWindmillSurplusCycle.execute({
      month,
      monthIndex: timeInfo.monthIndex,
      dayInMonth: timeInfo.dayInMonth ?? 1,
      year: timeInfo.year ?? 0,
    });

    await this.runCityResourceCycle.execute({
      categories: FOOD_CIRCUIT.crops,
      distributeCircuit: MARKET_DISTRIBUTE_CIRCUIT,
      hubTransferCircuit: MARKET_WINDMILL_TRANSFER_CIRCUIT,
      season,
      month,
      timeInfo,
      maxDistance,
    });

    await this.updateHousesMarketReach.execute({ maxDistance });

    if (this.produceAllHouseSubsistenceFood) {
      await this.produceAllHouseSubsistenceFood.execute({
        monthIndex: timeInfo.monthIndex,
      });
    }

    const consumeOutcome = await this.consumeAllHouseFood.execute({
      monthIndex: timeInfo.monthIndex,
    });

    await this.traceability.recordHouseConsumptions(
      timeInfo,
      consumeOutcome.consumptions
    );
  }
}
