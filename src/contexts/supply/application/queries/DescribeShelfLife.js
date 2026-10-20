/**
 * Query (CQRS read): how long the stock of one building has left to live, good by good, for the shelf-life screen. For each good the building handles
 * that can go bad: what it holds, the life it has here (its own months times the building's `shelfLifeFactor`) and what is left of each batch, oldest
 * first. A good that never goes bad is not listed. Times are in turns; the screen turns them into months with the calendar's days. Read-only.
 */
import { listRoleEntries } from '../../domain/policies/ResourceRolePolicy.js';
import { remainingLifeOf, reconcileAges, shelfLifeTurnsOf } from '../../domain/policies/StockAgingPolicy.js';
import { getDeliveryCycleMonths, getServiceCategories, getShelfLifeMonths } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

const KEEPING_ROLES = Object.freeze(['producer', 'hub', 'distributor']);

export class DescribeShelfLife {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository, { sumShelfFlowsOf }) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    /** What a building sold on and lost to spoilage over a range of months, per good. */
    this.sumShelfFlowsOf = sumShelfFlowsOf;
  }

  /**
   * @param {{ buildingId: string, turn: number }} params
   * @returns {Promise<{ buildingType: string, daysPerMonth: number, goods: Array<{ category: string, amount: number, factor: number, lifeTurns: number, lots: Array<{ amount: number, remainingTurns: number }> }> }>}
   */
  async execute({ buildingId, turn }) {
    if (!Number.isFinite(turn)) throw new Error(`[shelf-life] the shelf-life screen needs the turn, got ${turn}`);
    const building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) throw new Error(`[shelf-life] building ${buildingId} is not in the city`);
    const services = new Set(getServiceCategories());
    const daysPerMonth = TimeManager.DAYS_PER_MONTH;
    const now = TimeManager.getTimeInfo(turn);
    const nowKey = (now.year ?? 0) * MONTHS_PER_YEAR + now.monthIndex;

    const goods = [];
    const seen = new Set();
    for (const role of KEEPING_ROLES) {
      for (const entry of listRoleEntries(building.type, role)) {
        for (const category of entry.categories) {
          if (seen.has(category) || services.has(category)) continue;
          seen.add(category);
          const months = getShelfLifeMonths(category);
          if (months === Infinity) continue;
          const factor = listRoleEntries(building.type, 'hub').find((hub) => hub.categories.includes(category))?.shelfLifeFactor ?? 1;
          const lifeTurns = shelfLifeTurnsOf({ shelfLifeMonths: months, factor, daysPerMonth });
          const amount = building.stocks[category] ?? 0;
          const ages = reconcileAges(building.stockAges?.[category], amount, turn);
          goods.push({ category, amount, factor, lifeTurns, cycleMonths: getDeliveryCycleMonths(category), lots: remainingLifeOf({ ages, turn, lifeTurns }) });
        }
      }
    }

    // What went through the stock over each good's delivery cycle (the months up to this one): read once for the longest, summed per good.
    if (goods.length > 0) {
      const longest = Math.max(...goods.map((good) => good.cycleMonths));
      const flows = await this.sumShelfFlowsOf(building.id, { fromKey: nowKey - longest + 1, toKey: nowKey });
      for (const good of goods) {
        let sold = 0;
        let spoiled = 0;
        for (const [key, month] of Object.entries(flows[good.category] ?? {})) {
          if (Number(key) <= nowKey - good.cycleMonths) continue;
          sold += month.sold;
          spoiled += month.spoiled;
        }
        good.cycle = { spoiled, handled: sold + spoiled };
      }
    }
    return { buildingType: building.type, daysPerMonth, goods };
  }
}
