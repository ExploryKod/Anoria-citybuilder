import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { findBuildingsWithRoleInRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { getRangeForRole } from '../../../domain/policies/ResourceRolePolicy.js';
import {
  MARKET_WINDMILL_TRANSFER_CIRCUIT,
  MARKET_DISTRIBUTE_CIRCUIT,
} from '../../../domain/catalogs/FoodCircuits.js';

/**
 * Orchestration: windmill procurement + distribution for every market in the city.
 */
export class RunCityMarketFoodCycle {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./TransferHubToHub.js').TransferHubToHub} transferHubToHub
   * @param {import('../distribution/DistributeResourceToConsumers.js').DistributeResourceToConsumers} distributeResourceToConsumers
   * @param {import('./UpdateMarketWindmillLink.js').UpdateMarketWindmillLink} updateMarketWindmillLink
   * @param {import('../../../infrastructure/presentation/SupplyFoodTraceability.js').SupplyFoodTraceability} traceability
   * @param {{ publish: (event: object) => void }} [eventPublisher] Optional —
   *   when given, one 'supply.resourceDelivered' domain event is published
   *   per market→house transfer (see shared/gameplay/walkerEventCatalog.js).
   *   Purely a side-channel notification; distribution itself does not
   *   depend on it.
   */
  constructor(
    supplyBuildingRepository,
    transferHubToHub,
    distributeResourceToConsumers,
    updateMarketWindmillLink,
    traceability,
    eventPublisher
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.transferHubToHub = transferHubToHub;
    this.distributeResourceToConsumers = distributeResourceToConsumers;
    this.updateMarketWindmillLink = updateMarketWindmillLink;
    this.traceability = traceability;
    this.eventPublisher = eventPublisher;
  }

  /**
   * @param {object} params
   * @param {string | null} params.season
   * @param {string | null} [params.month]
   * @param {object} params.timeInfo
   * @param {number} params.maxDistance
   * @returns {Promise<{ marketsProcessed: number }>}
   */
  async execute({ season, month = null, timeInfo, maxDistance = 5 }) {
    const markets = await this.supplyBuildingRepository.findMarkets();
    const allBuildings = await this.supplyBuildingRepository.listAllBuildingRows();
    let marketsProcessed = 0;

    for (const market of markets) {
      const processed = await this.#processMarket({
        market,
        allBuildings,
        season,
        month,
        timeInfo,
        maxDistance,
      });
      if (processed) marketsProcessed += 1;
    }

    return { marketsProcessed };
  }

  async #processMarket({ market, allBuildings, season, month, timeInfo, maxDistance }) {
    const marketRow = await this.supplyBuildingRepository.findBuildingRow(market.id);
    if (!marketRow) return false;

    if (
      !isOperational({
        roadCount: marketRow.roads ?? market.roadCount,
        worker: market.worker,
        workerNeed: market.workerNeed,
      })
    ) {
      return false;
    }

    await this.updateMarketWindmillLink.execute({
      marketId: market.id,
      hasWindmillLink: Boolean(market.supplyWindmillId),
    });

    const buyOutcome = await this.transferHubToHub.execute({
      targetId: market.id,
      period: { month },
      circuit: MARKET_WINDMILL_TRANSFER_CIRCUIT,
    });

    if (buyOutcome.transferred) {
      await this.traceability.recordWindmillToMarketTransfers(
        timeInfo,
        market.id,
        buyOutcome.transfers.map((t) => ({ windmillId: t.sourceId, crop: t.category, amount: t.amount }))
      );
    }

    // The market's own catalog-declared distributor range is authoritative;
    // `maxDistance` is only a fallback for a type that doesn't declare one.
    const housesInRange = findBuildingsWithRoleInRange(marketRow, allBuildings, {
      role: 'consumer',
      maxDistance: getRangeForRole(market.type, 'distributor') ?? maxDistance,
    });
    if (housesInRange.length > 0) {
      const distributeOutcome = await this.distributeResourceToConsumers.execute({
        sourceId: market.id,
        consumerRefs: housesInRange,
        period: { season },
        circuit: MARKET_DISTRIBUTE_CIRCUIT,
      });

      if (distributeOutcome.distributed) {
        await this.traceability.recordMarketToHouseTransfers(
          timeInfo,
          market.id,
          distributeOutcome.transfers.map((t) => ({ houseId: t.consumerId, crop: t.category, amount: t.amount }))
        );

        for (const transfer of distributeOutcome.transfers) {
          this.eventPublisher?.publish({
            type: 'supply.resourceDelivered',
            sourceId: market.id,
            consumerId: transfer.consumerId,
            category: transfer.category,
            amount: transfer.amount,
          });
        }
      }
    }

    return true;
  }
}
