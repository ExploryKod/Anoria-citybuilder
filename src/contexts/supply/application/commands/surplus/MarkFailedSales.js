import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { isWithinRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { getHubProductRemainingInbound, normalizeHubStorageOrders } from '../../../domain/policies/HubStorageOrdersPolicy.js';
import {
  getAllCategoriesForRole,
  getCategoriesForRole,
  getRangeForRole,
  getResourceRoles,
  getTotalKeyForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a producer that has a `sale` window is watched across it. When the window has just closed and the
 * producer still holds what it was to sell (the hub had no room, none was in range, none was working…), it says so:
 * `lastFailedSale` records when, how many units stayed unsold and why, for the map to show for a moment.
 *
 * The watch is a flag on the producer (`saleWindowOpen`) that is set while the window is open: the tick it is no
 * longer open and the flag is still set is the tick the window closed.
 */
export class MarkFailedSales {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {{ year?: number, monthIndex?: number }} params.period The time context of the tick.
   * @returns {Promise<{ failed: number }>}
   */
  async execute({ period }) {
    const collected = getAllCategoriesForRole('collector');
    const producers = await this.supplyBuildingRepository.findByResourceRole('producer', collected);
    let failed = 0;

    for (const producer of producers) {
      const entries = getResourceRoles(producer.type).filter(
        (candidate) => candidate.role === 'producer' && candidate.sale && candidate.categories.some((c) => collected.includes(c))
      );
      if (entries.length === 0) continue;

      // Every activity-recipe entry on a building shares the same twoMonthCycle sale window
      // today, so any one of them says whether the window is open — only WHICH good stayed
      // unsold, below, must look at all of them, not just the first.
      if (matchesSchedule(entries[0].sale.schedule, period)) {
        if (producer.saleWindowOpen !== true) {
          await this.supplyBuildingRepository.updateBuildingFields(producer.id, { saleWindowOpen: true });
        }
        continue;
      }
      if (producer.saleWindowOpen !== true) continue;

      // The window has just closed. A building can run more than one sale-bearing recipe (a
      // merchant's dealWood/dealDecoratedPot/dealBook) — each is checked for leftover stock,
      // not just the first: picking only the first used to silently miss a real unsold surplus
      // whenever THAT one category happened to be empty (e.g. no wood chain built in this city).
      const unsoldCategories = [
        ...new Set(entries.flatMap((entry) => entry.categories.filter((c) => collected.includes(c)))),
      ].filter((category) => (producer.stocks?.[category] ?? 0) > 0);

      // `unpaidByHub` (set by CollectResourceToHub when a hub could not pay for what a producer offered) is the window's own: it ends with it.
      const fields = { saleWindowOpen: false, unpaidByHub: false };
      if (unsoldCategories.length > 0) {
        const units = unsoldCategories.reduce((sum, category) => sum + (producer.stocks?.[category] ?? 0), 0);
        fields.lastFailedSale = {
          year: period.year ?? 0,
          monthIndex: period.monthIndex ?? null,
          units,
          cause: await this.#cause(producer, unsoldCategories[0]),
        };
        failed += 1;
      }
      await this.supplyBuildingRepository.updateBuildingFields(producer.id, fields);
    }

    return { failed };
  }

  /** Why nothing took it: no hub of its goods within reach, one that was not working, one that was full, or one that could not pay for it. */
  async #cause(producer, category) {
    const hubs = await this.supplyBuildingRepository.findByResourceRole('collector', [category]);
    const inReach = hubs.filter((hub) => isWithinRange(hub, producer, getRangeForRole(hub.type, 'collector') ?? Infinity));
    if (inReach.length === 0) return 'no_hub';

    const working = inReach.filter((hub) =>
      isOperational({ type: hub.type, roadCount: hub.roadCount, worker: hub.worker, workerNeed: hub.workerNeed })
    );
    if (working.length === 0) return 'hub_idle';

    const withRoom = working.filter((hub) => (hub.stocks?.[getTotalKeyForRole(hub.type, 'collector')] ?? 0) < hub.maxStock);
    if (withRoom.length === 0) return 'hub_full';

    // The hub as a whole has room, but each good has its own ceiling (a share of the hub, set by its storage orders).
    const withRoomForGood = withRoom.filter((hub) => {
      const goods = getCategoriesForRole(hub.type, 'hub');
      return getHubProductRemainingInbound({
        productId: category,
        productIds: goods,
        orders: normalizeHubStorageOrders(hub.hubStorageOrders, goods),
        stocks: hub.stocks ?? {},
        totalCapacity: hub.maxStock,
      }) > 0;
    });
    if (withRoomForGood.length === 0) return 'good_ceiling';

    // A hub that had room and a road took only what it could pay (see CollectResourceToHub): it said so on the producer when it left some of its goods. What it could pay is read then, not
    // now: by the time the window has closed the month's settlement has paid its purchases and its money is back.
    if (producer.unpaidByHub === true) return 'hub_no_money';

    throw new Error(`[sales] ${producer.type} ${producer.id} could not sell its ${category}: a working hub in reach has room for it, yet it was not collected`);
  }
}
