import { remainingHubCapacity } from '../../../domain/policies/HubCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { resolveInstanceIdFromBuildingRef } from '../../../../../shared/building-identity/BuildingRecord.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import {
  getCategoriesForRole,
  getRangeForRole,
  getResourceRoles,
  getCollectionSchedule,
  getTotalKeyForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';
import { isWithinRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { getHubProductRemainingInbound, normalizeHubStorageOrders } from '../../../domain/policies/HubStorageOrdersPolicy.js';
import { movedAgeBooks } from '../../../domain/policies/StockAgingPolicy.js';

/**
 * Command: a hub building collects resource units from a list of source
 * building refs, up to its own remaining capacity (December-only windmill
 * collection today; resource-agnostic otherwise). WHAT/WHEN come from the
 * hub's own 'collector' role; each source's own 'producer' role says which
 * single category it contributes.
 */
export class CollectResourceToHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {object | null} hubServing
   * @param {{ priceBook: object, purchasingPower: (params: { buyerId: string, period: object }) => Promise<number> }} pricing the prices of the sellers, and the euros the hub may still spend with them
   */
  constructor(supplyBuildingRepository, hubServing, pricing) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.hubServing = hubServing;
    this.pricing = pricing;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {object[]} params.sourceRefs
   * @param {object} params.period
   * @returns {Promise<{
   *   collected: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ hubId, sourceRefs = [], period }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { collected: false, reason: 'hub_not_found', transfers: [], totalUnits: 0 };
    }

    const schedule = getCollectionSchedule(hub.type);
    if (!matchesSchedule(schedule, period)) {
      return { collected: false, reason: 'not_collection_period', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        type: hub.type,
        roadCount: hub.roadCount,
        worker: hub.worker,
        workerNeed: hub.workerNeed,
      })
    ) {
      return { collected: false, reason: 'hub_not_operational', transfers: [], totalUnits: 0 };
    }

    const categories = getCategoriesForRole(hub.type, 'collector');
    const totalKey = getTotalKeyForRole(hub.type, 'collector');
    // A collector that declares a `range` only collects from sources within it; none means city-wide.
    const range = getRangeForRole(hub.type, 'collector') ?? Infinity;

    let capacity = remainingHubCapacity(hub.stocks[totalKey], hub.maxStock);
    if (capacity <= 0) {
      return { collected: false, reason: 'hub_full', transfers: [], totalUnits: 0 };
    }

    // What the hub's storage orders let it take: a good it refuses (or is emptying) comes in at no unit, and one
    // held to a ceiling only up to it. Read against the stock as this pass fills it.
    const hubGoods = getCategoriesForRole(hub.type, 'hub');
    const orders = normalizeHubStorageOrders(hub.hubStorageOrders, hubGoods);
    const running = { ...hub.stocks };

    await this.pricing.priceBook.ensure(period);
    let budget = await this.pricing.purchasingPower({ buyerId: hubId, period });
    let shortOfMoney = false;

    const transfers = [];
    // Each unit keeps its age on the way (see StockAgingPolicy.js): what was taken, from whom, out of how much.
    const ageMoves = [];

    for (const ref of sourceRefs) {
      if (capacity <= 0) break;

      const sourceId = resolveInstanceIdFromBuildingRef(ref);
      if (!sourceId) continue;

      const source = await this.supplyBuildingRepository.findById(sourceId);
      if (!source) continue;

      if (!isRoadNeedMet(source.type, source.roadCount)) continue;
      if (range !== Infinity && !isWithinRange(hub, source, range)) continue;
      // A producer that declares its own `sale` window sells only inside it (its cycle is done by then).
      const sale = getResourceRoles(source.type).find(
        (entry) => entry.role === 'producer' && entry.sale && entry.categories.some((c) => categories.includes(c))
      )?.sale;
      if (sale && !matchesSchedule(sale.schedule, period)) continue;

      // Only goods this hub collects: a producer of anything else (household
      // gathering, another chain's output) is simply not this hub's business.
      // A house merges several 'producer' entries into one resourceRoles array, and more than one
      // can sell to the SAME hub (a merchant's dealWood/dealDecoratedPot/dealBook all go to
      // TradeWarehouse) — every one of the source's categories this hub collects is tried, not
      // just the first: picking only the first used to skip a source outright whenever that one
      // category was empty, even with stock sitting in another (dealDecoratedPot piling up forever
      // because dealWood, tried first, was always 0 — no wood chain built in that city).
      const sourceCategories = [
        ...new Set(
          getResourceRoles(source.type)
            .filter((entry) => entry.role === 'producer')
            .flatMap((entry) => entry.categories)
            .filter((candidate) => categories.includes(candidate))
        ),
      ];
      if (sourceCategories.length === 0) continue;

      let sourceStocks = source.stocks;
      let tookAny = false;
      for (const category of sourceCategories) {
        if (capacity <= 0) break;
        const available = getCategoryAmount(sourceStocks, category);
        const room = getHubProductRemainingInbound({
          productId: category,
          productIds: hubGoods,
          orders,
          stocks: running,
          totalCapacity: hub.maxStock,
        });
        // The hub pays for what it takes, at the price it is traced at: it takes only what its money and its suppliers' credit cover.
        const price = this.pricing.priceBook.sellingPrice(source, category, period);
        if (!(price >= 0)) throw new Error(`[supply] ${source.type} sells ${category} at ${price}: the hub cannot buy it`);
        const wanted = Math.min(available, capacity, room);
        // An agreement (a trade deal) is no good yet and costs nothing: it is always affordable.
        const amount = price === 0 ? wanted : Math.min(wanted, Math.floor(Math.round(budget * 100) / Math.round(price * 100)));
        if (amount < wanted) shortOfMoney = true;
        if (amount <= 0) continue;
        budget = Math.round((budget - amount * price) * 100) / 100;
        running[category] = (running[category] ?? 0) + amount;
        sourceStocks = takeCategoryAmount(sourceStocks, category, amount, categories, totalKey);
        capacity -= amount;
        transfers.push({ sourceId, category, amount });
        ageMoves.push({ source, category, amount, sourceStock: available });
        tookAny = true;
      }
      if (tookAny) {
        await this.supplyBuildingRepository.saveStocks(sourceId, sourceStocks);
      }
    }

    if (transfers.length === 0) {
      return { collected: false, reason: shortOfMoney ? 'no_budget' : 'nothing_to_collect', transfers: [], totalUnits: 0 };
    }

    const freshHub = await this.supplyBuildingRepository.findById(hubId);
    let merged = createResourceStock(freshHub?.stocks ?? hub.stocks, categories, totalKey);
    for (const transfer of transfers) {
      merged = addCategoryAmount(merged, transfer.category, transfer.amount, categories, totalKey);
    }
    const cappedTotal = Math.min(freshHub?.maxStock ?? hub.maxStock, merged[totalKey]);
    const finalStock = createResourceStock(
      { ...merged, [totalKey]: cappedTotal },
      categories,
      totalKey,
    );
    await this.supplyBuildingRepository.saveStocks(hubId, finalStock);
    await this.#carryAges({ hub, ageMoves, turn: period?.turn });

    // What came in is filed under the producer instance that delivered it, so the hub can serve its
    // clients in the order that instance's own priority setting asks for.
    if (this.hubServing) {
      let stockAfter = {};
      for (const transfer of transfers) {
        stockAfter[transfer.category] = (stockAfter[transfer.category] ?? (hub.stocks[transfer.category] ?? 0)) + transfer.amount;
        await this.hubServing.deposit({
          hubId,
          category: transfer.category,
          producerId: transfer.sourceId,
          amount: transfer.amount,
          stockAfter: stockAfter[transfer.category],
        });
      }
    }

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { collected: true, transfers, totalUnits };
  }

  /**
   * The age of what the hub took goes with it: the oldest units of each source go first, and the hub's batches take them in.
   * @param {{ hub: object, ageMoves: Array<{ source: object, category: string, amount: number, sourceStock: number }>, turn: number }} params
   */
  async #carryAges({ hub, ageMoves, turn }) {
    let hubBook = hub.stockAges;
    const hubStock = { ...hub.stocks };
    const sourceBooks = new Map();
    for (const move of ageMoves) {
      const moved = movedAgeBooks({
        category: move.category,
        amount: move.amount,
        turn,
        from: { book: sourceBooks.get(move.source.id) ?? move.source.stockAges, stock: move.sourceStock },
        to: { book: hubBook, stock: hubStock[move.category] ?? 0 },
      });
      sourceBooks.set(move.source.id, moved.from);
      hubBook = moved.to;
      hubStock[move.category] = (hubStock[move.category] ?? 0) + move.amount;
    }
    for (const [sourceId, book] of sourceBooks) {
      const original = ageMoves.find((move) => move.source.id === sourceId).source.stockAges;
      if (book !== original) await this.supplyBuildingRepository.updateBuildingFields(sourceId, { stockAges: book });
    }
    if (hubBook !== hub.stockAges) await this.supplyBuildingRepository.updateBuildingFields(hub.id, { stockAges: hubBook });
  }
}
