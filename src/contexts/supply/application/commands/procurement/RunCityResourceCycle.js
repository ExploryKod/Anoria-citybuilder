import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { findBuildingsWithRoleInRange } from '../../../domain/policies/ResourceRangePolicy.js';
import {
  requireRangeForRole,
  getHubLinkForRole,
  getConsumptionModeForRole,
  listRoleEntries,
  computeConsumerDeficit,
} from '../../../domain/policies/ResourceRolePolicy.js';
import { isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { resolveInstanceIdFromNeighborRef } from '../../../../../shared/building-identity/BuildingRecord.js';

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
   *   'supply.resourceDeliveryRoute' event per distributor PER CYCLE (see
   *   shared/gameplay/walkerEventCatalog.js), not per unit-transfer: the
   *   round-robin distribution can move many units to many consumers in one
   *   pass, but that's one economic batch, not one walker each. The event
   *   carries sourceId + the distinct consumerIds actually reached this
   *   cycle (order = first-served order, i.e. round-robin's own consumerIds
   *   order) — WalkerEventController turns that into ONE walker's route.
   *   Resource-agnostic either way.
   * @param {object} [hooks]
   * @param {import('./TransferHubToHub.js').TransferHubToHub} [hooks.transferHubToHub] Omit for a resource with no hub leg.
   * @param {(params: { distributorId: string, x: number, y: number, entry: object }) => Promise<unknown>} [hooks.linkDistributorEntry]
   * @param {(distributorId: string, hasHubLink: boolean) => Promise<void>} [hooks.onHubLinkResolved]
   * @param {(distributorId: string, transfers: object[], timeInfo: object) => Promise<void>} [hooks.onHubTransfer]
   * @param {(distributorId: string, transfers: object[], timeInfo: object) => Promise<void>} [hooks.onDistribute]
   */
  constructor(supplyBuildingRepository, distributeResourceToConsumers, eventPublisher, hooks = {}) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.distributeResourceToConsumers = distributeResourceToConsumers;
    this.eventPublisher = eventPublisher;
    this.transferHubToHub = hooks.transferHubToHub;
    this.linkDistributorEntry = hooks.linkDistributorEntry;
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
   * @returns {Promise<{ distributorsProcessed: number }>}
   */
  async execute({ categories, season, month = null, timeInfo }) {
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
      });
      if (processed) distributorsProcessed += 1;
    }

    return { distributorsProcessed };
  }

  async #processDistributor({ distributor, allBuildings, season, month, timeInfo }) {
    const distributorRow = await this.supplyBuildingRepository.findBuildingRow(distributor.id);
    if (!distributorRow) return false;

    if (
      !isOperational({
        type: distributor.type,
        roadCount: distributorRow.roads ?? distributor.roadCount,
        worker: distributor.worker,
        workerNeed: distributor.workerNeed,
      })
    ) {
      return false;
    }

    // One pass per thing the building distributes (a market: its diet, and each goods entry the catalog
    // gives it), each with its own goods, reach, hub and ceiling.
    const entries = listRoleEntries(distributor.type, 'distributor');
    for (const [index, entry] of entries.entries()) {
      await this.#processDistributorEntry({ distributor, distributorRow, entry, isPrimary: index === 0, allBuildings, season, month, timeInfo });
    }

    return true;
  }

  async #processDistributorEntry({ distributor, distributorRow, entry, isPrimary, allBuildings, season, month, timeInfo }) {
    const category = entry.categories[0];
    const consumersInRange = findBuildingsWithRoleInRange(distributorRow, allBuildings, {
      role: 'consumer',
      category: entry.categories,
      maxDistance: requireRangeForRole(distributor.type, 'distributor', category),
    });

    const distributorHubLink = getHubLinkForRole(distributor.type, 'distributor', category);
    // An entry still without a hub tries to find one (a hub built after it, a save from before the entry).
    if (distributorHubLink && !distributor[distributorHubLink.sourceLinkField] && this.linkDistributorEntry) {
      await this.linkDistributorEntry({ distributorId: distributor.id, x: distributorRow.x, y: distributorRow.y, entry });
    }
    if (this.transferHubToHub && distributorHubLink) {
      // The pull is sized on what the consumers it serves still need — read fresh, since a
      // distributor handled earlier this cycle may already have filled some of them.
      const hubOutcome = await this.transferHubToHub.execute({
        targetId: distributor.id,
        period: { month, year: timeInfo?.year, monthIndex: timeInfo?.monthIndex },
        demand: await this.#demandOf(consumersInRange, category),
        category,
      });

      // The "no hub" flag is about its main supply; another entry's hub is an extra it may lack.
      if (this.onHubLinkResolved && isPrimary) {
        await this.onHubLinkResolved(distributor.id, Boolean(distributor[distributorHubLink.sourceLinkField]));
      }

      if (hubOutcome.transferred) {
        // It really bought: its activity icon lights for the rest of this month.
        await this.supplyBuildingRepository.updateBuildingFields(distributor.id, {
          lastTransaction: { year: timeInfo?.year ?? 0, monthIndex: timeInfo?.monthIndex ?? null },
        });
      }

      if (hubOutcome.transferred && this.onHubTransfer) {
        await this.onHubTransfer(distributor.id, hubOutcome.transfers, timeInfo);
      }
    }

    if (consumersInRange.length > 0) {
      const distributeOutcome = await this.distributeResourceToConsumers.execute({
        sourceId: distributor.id,
        consumerRefs: consumersInRange,
        category,
        // monthIndex is what PeriodLockPolicy.resolvePeriodKey('month', ...)
        // actually reads (not `month`, the season-relative name) — without
        // it, every flag-mode service (Chapel's faith, School, Doctor, ...)
        // falls back to period key 0 forever, so a consumer's periodLock
        // only ever matches in month 0 and looks permanently unserved (or
        // gets demoted right back) every month after.
        period: { season, month, monthIndex: timeInfo.monthIndex },
      });

      if (distributeOutcome.distributed) {
        if (this.onDistribute) {
          await this.onDistribute(distributor.id, distributeOutcome.transfers, timeInfo);
        }

        // One walker per distributor per cycle, not one per unit moved —
        // see this method's own @param doc. `transfers` can hold many
        // entries per consumer (one per unit/category/round-robin pass);
        // collapse to the distinct consumerIds, first-served order.
        const consumerIds = [...new Set(distributeOutcome.transfers.map((t) => t.consumerId))];
        if (consumerIds.length > 0) {
          this.eventPublisher?.publish({
            type: 'supply.resourceDeliveryRoute',
            sourceId: distributor.id,
            consumerIds,
          });
        }
      }
    }

    // A stall that buys just what its houses need and hands it all out leaves an empty stock every
    // tick, so "empty" says nothing. What says something is a house still waiting once it has done
    // what it could: that is the shortfall its no-food icon reports (its main supply only).
    if (isPrimary && getConsumptionModeForRole(distributor.type, 'distributor', category) !== 'flag') {
      await this.supplyBuildingRepository.updateBuildingFields(distributor.id, {
        unmetDemand: await this.#demandOf(consumersInRange, category),
      });
    }
  }

  /**
   * Units the given consumers still need, road-connected ones only (the same gate the
   * distribution applies), each read fresh from the repository.
   * @param {object[]} consumerRefs
   * @param {string} category Any good of the need the units are counted for.
   * @returns {Promise<number>}
   */
  async #demandOf(consumerRefs, category) {
    const ids = new Set(
      consumerRefs.map(resolveInstanceIdFromNeighborRef).filter((id) => typeof id === 'string' && id.length > 0)
    );
    let demand = 0;
    for (const id of ids) {
      const consumer = await this.supplyBuildingRepository.findById(id);
      if (!consumer || !isRoadNeedMet(consumer.type, consumer.roadCount)) continue;
      demand += computeConsumerDeficit(consumer, category);
    }
    return demand;
  }
}
