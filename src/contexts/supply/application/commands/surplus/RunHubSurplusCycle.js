import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { getScheduleForRole, getAllCategoriesForRole } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Orchestration: monthly hub surplus cycle (flags, scheduled collection,
 * sales reset). Whether this is a collection period comes from the hub
 * buildings' own declared 'collector' schedule (see buildingEconomy.js) —
 * not a hardcoded month, so a future hub with a different cadence just
 * works, no change here.
 */
export class RunHubSurplusCycle {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./MarkHubCollectingSchedule.js').MarkHubCollectingSchedule} markHubCollectingSchedule
   * @param {import('./ResetSourcesCollectedFlag.js').ResetSourcesCollectedFlag} resetSourcesCollectedFlag
   * @param {import('./ProcessHubCollection.js').ProcessHubCollection} processHubCollection
   * @param {{ execute: (params: { hubId: string }) => Promise<unknown> }} [rebalanceHubDistributorAllocations]
   *   Any collaborator with this shape — composition wires the generic
   *   RebalanceHubAllocations behind an adapter that supplies the resource's categories.
   */
  constructor(
    supplyBuildingRepository,
    markHubCollectingSchedule,
    resetSourcesCollectedFlag,
    processHubCollection,
    rebalanceHubDistributorAllocations = null
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.markHubCollectingSchedule = markHubCollectingSchedule;
    this.resetSourcesCollectedFlag = resetSourcesCollectedFlag;
    this.processHubCollection = processHubCollection;
    this.rebalanceHubDistributorAllocations = rebalanceHubDistributorAllocations;
  }

  /**
   * @param {object} params
   * @param {string | null} params.month - English month label
   * @param {number} params.monthIndex - 0-based month index
   * @param {number} params.dayInMonth
   * @param {number} params.year
   * @returns {Promise<{ ranCollection: boolean, hubs?: object[] }>}
   */
  async execute({ month, monthIndex, dayInMonth, year }) {
    const hubs = await this.supplyBuildingRepository.findByResourceRole('hub');
    const isCollectionPeriod = hubs.some((hub) =>
      matchesSchedule(getScheduleForRole(hub.type, 'collector'), { month, monthIndex, year })
    );

    if (!isCollectionPeriod) {
      if (month) {
        await this.markHubCollectingSchedule.execute(month);
      }
      await this.resetSourcesCollectedFlag.execute({ onlyIfSet: true });
      return { ranCollection: false };
    }

    if (dayInMonth === 1) {
      await this.supplyBuildingRepository.resetSourceSalesForYear(year);
      await this.resetSourcesCollectedFlag.execute({ onlyIfSet: false });
    }

    if (month) {
      await this.markHubCollectingSchedule.execute(month);
    }

    // Only producers of goods a hub collects — never a household gathering its own food.
    const sources = await this.supplyBuildingRepository.findByResourceRole('producer', getAllCategoriesForRole('collector'));
    const sourceRefs = sources.map((source) => ({
      id: source.id,
      type: source.type,
      x: source.x,
      y: source.y,
    }));

    const hubResults = [];
    for (const hub of hubs) {
      // Hubs keep their own rhythm: the windmill collects in one month while a warehouse collects all
      // year, and one being due must not make the other run out of its period.
      if (!matchesSchedule(getScheduleForRole(hub.type, 'collector'), { month, monthIndex, year })) continue;

      const outcome = await this.processHubCollection.execute({
        hubId: hub.id,
        sourceRefs,
        month,
        year,
      });
      hubResults.push(outcome);

      if (outcome.collected && this.rebalanceHubDistributorAllocations) {
        await this.rebalanceHubDistributorAllocations.execute({ hubId: hub.id });
      }
    }

    return { ranCollection: true, hubs: hubResults };
  }
}
