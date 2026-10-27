import { remainingHubCapacity } from '../../../domain/policies/HubCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { movedAgeBooks } from '../../../domain/policies/StockAgingPolicy.js';
import { fairShares } from '../../services/RoundRobinDistribution.js';
import { freshUnitPricer } from '../../services/FreshUnitPricer.js';
import { shareByExpenditure } from '../../../domain/policies/ExpenditureSharePolicy.js';
import {
  getCategoriesForRole,
  getScheduleForRole,
  getTotalKeyForRole,
  getHubLinkForRole,
  getMaxStockForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a target hub restocks from its linked source hub by PULLING what its own
 * consumers still need (`demand`, units) — minus what it already holds — limited by what
 * the source has and by the room left in the target. The source's stock is therefore drawn
 * down at the pace of real consumption instead of being handed out in shares (monthly
 * market-from-windmill restock today; resource-agnostic otherwise). The pull is spread over
 * the goods the source holds by what the target SPENDS on each (ExpenditureSharePolicy), at the source's price of each
 * unit by its freshness: a variety of goods survives, and what is about to go bad is bought in larger quantity. WHAT/WHEN come from the target's own 'distributor' role in
 * the catalog; hub-link storage field names come from each side's own
 * `hubLink` catalog fact (target's 'distributor' role, source's 'hub' role)
 * — see ResourceRolePolicy.getHubLinkForRole. This command never names a
 * resource or a link field itself.
 */
export class TransferHubToHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  /**
   * @param {object} priceBook
   * @param {(params: { buyerId: string, period: object }) => Promise<number>} purchasingPower euros the target may still spend with its suppliers (see SupplierCreditPolicy)
   */
  constructor(supplyBuildingRepository, hubServing, priceBook, purchasingPower) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.hubServing = hubServing;
    this.priceBook = priceBook;
    this.purchasingPower = purchasingPower;
  }

  /**
   * @param {object} params
   * @param {string} params.targetId
   * @param {{ year?: number, monthIndex?: number }} params.period The month, to add up what leaves the hub in it
   * @param {number} params.demand Units the target's consumers still need (see computeConsumerDeficit).
   * @param {string} [params.category] Any good of the target's 'distributor' entry to restock, when it has several.
   * @returns {Promise<{
   *   transferred: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number, unitPrice: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ targetId, period, demand, category }) {
    const target = await this.supplyBuildingRepository.findById(targetId);
    if (!target) {
      return { transferred: false, reason: 'target_not_found', transfers: [], totalUnits: 0 };
    }

    const schedule = getScheduleForRole(target.type, 'distributor', category);
    if (!matchesSchedule(schedule, period)) {
      return { transferred: false, reason: 'not_transfer_period', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        type: target.type,
        roadCount: target.roadCount,
        worker: target.worker,
        workerNeed: target.workerNeed,
      })
    ) {
      return { transferred: false, reason: 'target_not_operational', transfers: [], totalUnits: 0 };
    }

    const targetHubLink = getHubLinkForRole(target.type, 'distributor', category);
    const sourceId = targetHubLink ? target[targetHubLink.sourceLinkField] : undefined;
    if (!sourceId) {
      return { transferred: false, reason: 'no_source_link', transfers: [], totalUnits: 0 };
    }

    const source = await this.supplyBuildingRepository.findById(sourceId);
    if (!source) {
      return { transferred: false, reason: 'source_not_found', transfers: [], totalUnits: 0 };
    }

    const sourceHubLink = getHubLinkForRole(source.type, 'hub');

    if (
      !isOperational({
        type: source.type,
        roadCount: source.roadCount,
        worker: source.worker,
        workerNeed: source.workerNeed,
      })
    ) {
      return { transferred: false, reason: 'source_not_operational', transfers: [], totalUnits: 0 };
    }

    const links = [...(source[sourceHubLink.linksField] ?? [])];
    const linkIndex = links.findIndex((entry) => entry[sourceHubLink.linkTargetIdField] === targetId);
    if (linkIndex < 0) {
      return { transferred: false, reason: 'target_not_linked', transfers: [], totalUnits: 0 };
    }

    const categories = getCategoriesForRole(target.type, 'distributor', category);
    const totalKey = getTotalKeyForRole(target.type, 'distributor', category);

    // The source files its goods under ITS OWN aggregate (a hub's `goods`), the target under its own (a market's
    // `heat`): each side is read and written by its own keys.
    const sourceCategories = getCategoriesForRole(source.type, 'hub');
    const sourceTotalKey = getTotalKeyForRole(source.type, 'hub');
    let sourceStock = createResourceStock(source.stocks, sourceCategories, sourceTotalKey);
    let targetStock = createResourceStock(target.stocks, categories, totalKey);

    const wanted = Math.max(0, demand - targetStock[totalKey]);
    if (!(wanted > 0)) {
      return { transferred: false, reason: 'no_demand', transfers: [], totalUnits: 0 };
    }

    const targetCapacity = remainingHubCapacity(target.stocks[totalKey], getMaxStockForRole(target.type, 'distributor', category));
    if (targetCapacity <= 0) {
      return { transferred: false, reason: 'target_full', transfers: [], totalUnits: 0 };
    }

    // What this client may take of each good depends on who delivered it and who else is waiting (see HubServing).
    const turn = period?.turn ?? 0;
    const asking = Math.min(wanted, targetCapacity);
    const available = await Promise.all(categories.map((category) => this.hubServing.availableTo(source, category, target.id, turn)));
    await this.priceBook.ensure(period);
    const unitPriceOf = freshUnitPricer({ seller: source, stock: sourceStock, priceBook: this.priceBook, period: { ...period, turn } });
    const budget = await this.purchasingPower({ buyerId: target.id, period });
    const { amounts, spent } = shareByExpenditure({ caps: available, units: asking, priceOf: (index, nth) => unitPriceOf(categories[index], nth), budget });
    // How its ask would split over the goods, unconstrained: what it leaves on the table for those ranked below.
    const desired = fairShares(categories.map((category) => getCategoryAmount(sourceStock, category)), asking);

    const transfers = [];
    // Each unit keeps its age on the way (see StockAgingPolicy.js): the oldest units of the source go first.
    let sourceBook = source.stockAges;
    let targetBook = target.stockAges;
    categories.forEach((category, index) => {
      const amount = amounts[index];
      if (amount <= 0) return;
      const moved = movedAgeBooks({
        category,
        amount,
        turn,
        from: { book: sourceBook, stock: getCategoryAmount(sourceStock, category) },
        to: { book: targetBook, stock: getCategoryAmount(targetStock, category) },
      });
      sourceBook = moved.from;
      targetBook = moved.to;
      sourceStock = takeCategoryAmount(sourceStock, category, amount, sourceCategories, sourceTotalKey);
      targetStock = addCategoryAmount(targetStock, category, amount, categories, totalKey);
      // What the target paid per unit on average (the units differ in freshness, so in price): the trace and the books read it.
      transfers.push({ sourceId, category, amount, unitPrice: Math.round((spent[index] / amount) * 100) / 100 });
    });

    for (const [index, category] of categories.entries()) {
      if (desired[index] <= 0 && !(amounts[index] > 0)) continue;
      await this.hubServing.take({ hubId: sourceId, category, client: target.id, amount: amounts[index], turn });
      await this.hubServing.recordDemand({
        hubId: sourceId,
        category,
        client: target.id,
        turn,
        wanted: Math.max(desired[index], amounts[index]),
        served: amounts[index],
      });
    }

    if (transfers.length === 0) {
      return { transferred: false, reason: 'nothing_to_transfer', transfers: [], totalUnits: 0 };
    }

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);

    await this.supplyBuildingRepository.saveStocks(sourceId, sourceStock);
    await this.supplyBuildingRepository.saveStocks(targetId, targetStock);
    if (sourceBook !== source.stockAges) await this.supplyBuildingRepository.updateBuildingFields(sourceId, { stockAges: sourceBook });
    if (targetBook !== target.stockAges) await this.supplyBuildingRepository.updateBuildingFields(targetId, { stockAges: targetBook });
    // The pace at which the hub is drawn down: what left it this month, all its targets together.
    const previous = source.lastOutflow;
    const sameMonth = previous != null && previous.year === period?.year && previous.monthIndex === period?.monthIndex;
    await this.supplyBuildingRepository.updateBuildingFields(sourceId, {
      lastOutflow: {
        year: period?.year,
        monthIndex: period?.monthIndex,
        units: (sameMonth ? previous.units : 0) + totalUnits,
      },
    });

    return { transferred: true, transfers, totalUnits };
  }
}
