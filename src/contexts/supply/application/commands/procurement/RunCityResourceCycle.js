import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { findBuildingsWithRoleInRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { getRangeForRole, getHubLinkForRole } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Orchestration: generic resource cycle. Every building holding the
 * 'distributor' role for the given categories optionally restocks from a
 * linked hub, then distributes to nearby 'consumer'-role buildings.
 *
 * Which legs run is entirely config/catalog, not per-resource code — a
 * distributor's own `hubLink` catalog fact (see buildingCatalog.js /
 * ResourceRolePolicy.getHubLinkForRole) decides whether it has a restock
 * leg at all; a service with no hub (e.g. a school distributing
 * 'education' straight from its own capacity) simply omits `hubLink`. This
 * is why RunCityMarketFoodCycle got replaced: it hardcoded `findMarkets()`
 * and a food-specific distribute circuit by name, so a second resource
 * would have needed its own copy-pasted orchestrator class.
 *
 * Traceability/UI-flag side effects stay entirely out of this class via
 * optional callbacks — it doesn't know SupplyTraceability exists, or
 * what a market's UI flags are called; food's own composition wiring
 * supplies closures that adapt the generic transfer shape to those.
 */
export class RunCityResourceCycle {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('../distribution/DistributeResourceToConsumers.js').DistributeResourceToConsumers} distributeResourceToConsumers
   * @param {{ publish: (event: object) => void }} [eventPublisher] Optional — one
   *   'supply.resourceDelivered' event per distribute transfer (see
   *   shared/gameplay/walkerEventCatalog.js). Resource-agnostic: the event
   *   only ever carries sourceId/consumerId/category/amount.
   * @param {object} [hooks]
   * @param {import('./TransferHubToHub.js').TransferHubToHub} [hooks.transferHubToHub] Omit for a resource with no hub leg.
   * @param {(distributorId: string, hasHubLink: boolean) => Promise<void>} [hooks.onHubLinkResolved]
   * @param {(distributorId: string, transfers: object[], timeInfo: object) => Promise<void>} [hooks.onHubTransfer]
   * @param {(distributorId: string, transfers: object[], timeInfo: object) => Promise<void>} [hooks.onDistribute]
   */
  constructor(supplyBuildingRepository, distributeResourceToConsumers, eventPublisher, hooks = {}) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.distributeResourceToConsumers = distributeResourceToConsumers;
    this.eventPublisher = eventPublisher;
    this.transferHubToHub = hooks.transferHubToHub;
    this.onHubLinkResolved = hooks.onHubLinkResolved;
    this.onHubTransfer = hooks.onHubTransfer;
    this.onDistribute = hooks.onDistribute;
  }

  /**
   * @param {object} params
   * @param {string | string[]} params.categories Resource categories this cycle moves.
   * @param {string | null} [params.season]
   * @param {string | null} [params.month]
   * @param {object} params.timeInfo
   * @param {number} [params.maxDistance] Fallback when a distributor's own catalog range is undeclared.
   * @returns {Promise<{ distributorsProcessed: number }>}
   */
  async execute({ categories, season, month = null, timeInfo, maxDistance }) {
    const distributors = await this.supplyBuildingRepository.findByResourceRole('distributor', categories);
    const allBuildings = await this.supplyBuildingRepository.listAllBuildingRows();
    let distributorsProcessed = 0;

    for (const distributor of distributors) {
      const processed = await this.#processDistributor({
        distributor,
        allBuildings,
        season,
        month,
        timeInfo,
        maxDistance,
      });
      if (processed) distributorsProcessed += 1;
    }

    return { distributorsProcessed };
  }

  async #processDistributor({ distributor, allBuildings, season, month, timeInfo, maxDistance }) {
    const distributorRow = await this.supplyBuildingRepository.findBuildingRow(distributor.id);
    if (!distributorRow) return false;

    if (
      !isOperational({
        roadCount: distributorRow.roads ?? distributor.roadCount,
        worker: distributor.worker,
        workerNeed: distributor.workerNeed,
      })
    ) {
      return false;
    }

    const distributorHubLink = getHubLinkForRole(distributor.type, 'distributor');
    if (this.transferHubToHub && distributorHubLink) {
      const hubOutcome = await this.transferHubToHub.execute({
        targetId: distributor.id,
        period: { month },
      });

      if (this.onHubLinkResolved) {
        await this.onHubLinkResolved(distributor.id, Boolean(distributor[distributorHubLink.sourceLinkField]));
      }

      if (hubOutcome.transferred && this.onHubTransfer) {
        await this.onHubTransfer(distributor.id, hubOutcome.transfers, timeInfo);
      }
    }

    const consumersInRange = findBuildingsWithRoleInRange(distributorRow, allBuildings, {
      role: 'consumer',
      maxDistance: getRangeForRole(distributor.type, 'distributor') ?? maxDistance,
    });

    if (consumersInRange.length > 0) {
      const distributeOutcome = await this.distributeResourceToConsumers.execute({
        sourceId: distributor.id,
        consumerRefs: consumersInRange,
        period: { season, month },
      });

      if (distributeOutcome.distributed) {
        if (this.onDistribute) {
          await this.onDistribute(distributor.id, distributeOutcome.transfers, timeInfo);
        }

        for (const transfer of distributeOutcome.transfers) {
          this.eventPublisher?.publish({
            type: 'supply.resourceDelivered',
            sourceId: distributor.id,
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
