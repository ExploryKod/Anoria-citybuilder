import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import {
  getAllCategoriesForRole,
  getCategoriesForRole,
  getRangeForRole,
  getResourceRoles,
  getScheduleForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';
import { isWithinRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { rankHubDestinations } from '../../../domain/policies/HubDestinationPolicy.js';

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
   * @param {import('./MarkFailedSales.js').MarkFailedSales} [markFailedSales]
   * @param {import('./EmptyHubGoods.js').EmptyHubGoods} [emptyHubGoods]
   */
  constructor(
    supplyBuildingRepository,
    markHubCollectingSchedule,
    resetSourcesCollectedFlag,
    processHubCollection,
    rebalanceHubDistributorAllocations = null,
    markFailedSales = null,
    emptyHubGoods = null
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.markHubCollectingSchedule = markHubCollectingSchedule;
    this.resetSourcesCollectedFlag = resetSourcesCollectedFlag;
    this.processHubCollection = processHubCollection;
    this.rebalanceHubDistributorAllocations = rebalanceHubDistributorAllocations;
    this.markFailedSales = markFailedSales;
    this.emptyHubGoods = emptyHubGoods;
  }

  /**
   * @param {object} params
   * @param {string | null} params.month - English month label
   * @param {number} params.monthIndex - 0-based month index
   * @param {number} params.dayInMonth
   * @param {number} params.year
   * @param {string | null} [params.season]
   * @returns {Promise<{ ranCollection: boolean, hubs?: object[] }>}
   */
  async execute({ month, monthIndex, dayInMonth, year, season = null }) {
    const period = { season, month, monthIndex, year, dayInMonth };
    // A producer whose sale window has just closed with goods unsold says so (whichever hubs collect this tick).
    await this.markFailedSales?.execute({ period });
    // Hubs ordered to empty a good give some of it to the others each tick, whatever the collection period.
    await this.emptyHubGoods?.execute();
    const hubs = await this.supplyBuildingRepository.findByResourceRole('hub');
    const isCollectionPeriod = hubs.some((hub) =>
      matchesSchedule(getScheduleForRole(hub.type, 'collector'), { month, monthIndex, year })
    );

    if (!isCollectionPeriod) {
      if (month) {
        await this.markHubCollectingSchedule.execute(month);
      }
      await this.resetSourcesCollectedFlag.execute({ onlyIfSet: true, period });
      return { ranCollection: false };
    }

    // A producer's flag follows its own sale window, which can close on any tick, not only on a month's first day.
    await this.resetSourcesCollectedFlag.execute({ onlyIfSet: true, period, onlySaleWindows: true });

    if (dayInMonth === 1) {
      await this.supplyBuildingRepository.resetSourceSalesForYear(year);
      await this.resetSourcesCollectedFlag.execute({ onlyIfSet: false, period });
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

    // The hubs collecting this tick. Hubs keep their own rhythm: the windmill collects in one month while a
    // warehouse collects all year, and one being due must not make the other run out of its period.
    const collecting = hubs.filter((hub) => matchesSchedule(getScheduleForRole(hub.type, 'collector'), { month, monthIndex, year }));

    // Each producer sells to the best hub for its goods (one whose order is "fetch", then the nearest, see
    // HubDestinationPolicy); what that hub could not take goes on to the next best. Every collecting hub is
    // visited in the first round even with nothing assigned, so its flags and its record stay true.
    const hubResults = [];
    const tried = new Map();
    let pending = sourceRefs;
    for (let round = 0; round < collecting.length; round += 1) {
      const fresh = await this.supplyBuildingRepository.findByResourceRole('hub');
      const collectingNow = fresh.filter((hub) => collecting.some((candidate) => candidate.id === hub.id));
      const assigned = new Map(collecting.map((hub) => [hub.id, []]));

      for (const ref of pending) {
        const destination = await this.#bestHubFor(ref, collectingNow, tried.get(ref.id), period);
        if (!destination) continue;
        assigned.get(destination.id).push(ref);
        tried.set(ref.id, new Set([...(tried.get(ref.id) ?? []), destination.id]));
      }

      const visited = [];
      for (const hub of collecting) {
        const group = assigned.get(hub.id);
        if (round > 0 && group.length === 0) continue;
        const outcome = await this.processHubCollection.execute({ hubId: hub.id, sourceRefs: group, month, year, period });
        hubResults.push(outcome);
        visited.push(hub.id);
        if (outcome.collected && this.rebalanceHubDistributorAllocations) {
          await this.rebalanceHubDistributorAllocations.execute({ hubId: hub.id });
        }
      }

      // Those that still hold goods to place after this round try the next hub.
      const next = [];
      for (const ref of pending) {
        if (!tried.has(ref.id)) continue;
        const source = await this.supplyBuildingRepository.findById(ref.id);
        const category = this.#collectedCategory(source, collectingNow);
        if (source && category && (source.stocks?.[category] ?? 0) > 0) next.push(ref);
      }
      pending = next;
      if (pending.length === 0) break;
    }

    return { ranCollection: true, hubs: hubResults };
  }

  /** The good a producer sells to these hubs: the first of its own that one of them collects. */
  #collectedCategory(source, hubs) {
    if (!source) return null;
    return getCategoriesForRole(source.type, 'producer').find((category) =>
      hubs.some((hub) => getCategoriesForRole(hub.type, 'collector').includes(category))
    ) ?? null;
  }

  /**
   * The best hub, among those collecting, for a producer to sell to now: one it has not already been offered to, in
   * reach of that hub's collector range, and inside the producer's own sale window.
   */
  async #bestHubFor(ref, collectingHubs, alreadyTried, period) {
    const source = await this.supplyBuildingRepository.findById(ref.id);
    const category = this.#collectedCategory(source, collectingHubs);
    if (!category || (source.stocks?.[category] ?? 0) <= 0) return null;

    const sale = getResourceRoles(source.type).find((entry) => entry.role === 'producer' && entry.sale && entry.categories.includes(category))?.sale;
    if (sale && !matchesSchedule(sale.schedule, period)) return null;

    const ranked = rankHubDestinations({
      hubs: collectingHubs.filter((hub) => !alreadyTried?.has(hub.id)),
      category,
      from: source,
      inReach: (hub) => isWithinRange(hub, source, getRangeForRole(hub.type, 'collector') ?? Infinity),
    });
    return ranked[0]?.hub ?? null;
  }
}
