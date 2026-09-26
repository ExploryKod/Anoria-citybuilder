import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  getCategoriesForRole,
  getTotalKeyForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';
import { snapshotCarryOver } from '../../../domain/policies/HubCapacityPolicy.js';

/**
 * Command: collect surplus from all sources for one hub. Applies UI flags,
 * lastCollection, and source sales history. The collected categories and
 * total-key come from the hub's own declared 'collector' role (see
 * buildingEconomy.js) — not a fixed shape — so a hub collecting different
 * categories needs no change here.
 */
export class ProcessHubCollection {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./CollectResourceToHub.js').CollectResourceToHub} collectResourceToHub
   * @param {import('./SetHubCollectingFlag.js').SetHubCollectingFlag} setHubCollectingFlag
   * @param {import('./MarkSourceCollectedByHub.js').MarkSourceCollectedByHub} markSourceCollectedByHub
   */
  constructor(
    supplyBuildingRepository,
    collectResourceToHub,
    setHubCollectingFlag,
    markSourceCollectedByHub
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.collectResourceToHub = collectResourceToHub;
    this.setHubCollectingFlag = setHubCollectingFlag;
    this.markSourceCollectedByHub = markSourceCollectedByHub;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {object[]} params.sourceRefs
   * @param {string} params.month
   * @param {number} params.year
   * @param {object} [params.period] Full time context (falls back to `{ month }`).
   * @returns {Promise<{
   *   processed: boolean,
   *   collected: boolean,
   *   reason?: string,
   *   hubId?: string,
   *   totalUnits?: number,
   *   transfers?: object[],
   * }>}
   */
  async execute({ hubId, sourceRefs = [], month, year, period = null }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { processed: false, collected: false, reason: 'hub_not_found' };
    }

    const categories = getCategoriesForRole(hub.type, 'collector');
    const totalKey = getTotalKeyForRole(hub.type, 'collector');
    const emptyCollection = () => ({
      ...Object.fromEntries(categories.map((category) => [category, 0])),
      [totalKey]: 0,
    });

    if (
      !isOperational({
        type: hub.type,
        roadCount: hub.roadCount,
        worker: hub.worker,
        workerNeed: hub.workerNeed,
      })
    ) {
      await this.setHubCollectingFlag.execute({
        hubId,
        isCollecting: false,
      });
      return {
        processed: true,
        collected: false,
        reason: 'hub_not_operational',
        hubId,
      };
    }

    await this.setHubCollectingFlag.execute({
      hubId,
      isCollecting: true,
    });

    const outcome = await this.collectResourceToHub.execute({
      hubId,
      sourceRefs,
      period: period ?? { month },
    });

    if (!outcome.collected) {
      if (outcome.reason === 'hub_not_operational') {
        await this.setHubCollectingFlag.execute({
          hubId,
          isCollecting: false,
        });
      }

      await this.supplyBuildingRepository.saveHubLastCollection(hubId, emptyCollection());

      return {
        processed: true,
        collected: false,
        reason: outcome.reason,
        hubId,
      };
    }

    const collectionYear = Number.isFinite(year) ? Math.floor(year) : 0;

    const lastCollection = { ...emptyCollection(), [totalKey]: outcome.totalUnits };
    // Goods really came in: the hub's activity icon lights for the rest of this month.
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      lastTransaction: { year: collectionYear, monthIndex: period?.monthIndex ?? null },
    });

    for (const transfer of outcome.transfers) {
      const category = transfer.category;

      await this.markSourceCollectedByHub.execute({
        sourceId: transfer.sourceId,
        collected: true,
      });

      if (lastCollection[category] != null) {
        lastCollection[category] += transfer.amount;
      }

      await this.supplyBuildingRepository.recordSourceSaleToHub(transfer.sourceId, {
        year: collectionYear,
        productType: category,
        quantity: transfer.amount,
        hubId,
      });
    }

    await this.supplyBuildingRepository.saveHubLastCollection(
      hubId,
      lastCollection
    );

    // Tell the hub's old goods from this year's harvest, so the surplus of the years before can be
    // told as it is drawn down. The snapshot is taken once per year, from what `hub` held before this
    // collection (a later pass of the same month must not count the harvest already in as carried
    // over); what comes in is added up over the passes of the year.
    const previous = hub.carryOver?.year === collectionYear ? hub.carryOver : null;
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      carryOver: {
        year: collectionYear,
        stocks: previous?.stocks ?? snapshotCarryOver(hub.stocks, categories),
        harvested: Object.fromEntries(
          categories.map((category) => [category, (previous?.harvested?.[category] ?? 0) + lastCollection[category]])
        ),
      },
    });

    return {
      processed: true,
      collected: true,
      hubId,
      totalUnits: outcome.totalUnits,
      transfers: outcome.transfers.map((t) => ({ sourceId: t.sourceId, category: t.category, amount: t.amount })),
    };
  }
}
