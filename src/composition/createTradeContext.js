import { DexieCityTradeRepository } from '../contexts/geography/infrastructure/dexie/DexieCityTradeRepository.js';
import { RunMonthlyCityTradeCycle } from '../contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { TRADE_CATALOG, SATISFACTION_START, getTradeCatalogEntry } from '../shared/trade-catalog/TradeCatalog.js';
import { canOpenRelation } from '../contexts/geography/application/canOpenRelation.js';
import { getCategoriesForRole, getTotalKeyForRole } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { addCategoryAmount, takeCategoryAmount } from '../contexts/supply/domain/value-objects/ResourceStock.js';
import { buildPriceWaterfall } from '../contexts/geography/domain/policies/PriceWaterfallPolicy.js';
import { priceImportDelivery } from '../contexts/geography/domain/policies/ImportPricePolicy.js';
import { getResourceBaseValue } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import { unitPriceAtStage } from '../shared/resource-catalog/ValueChainCatalog.js';
import { getSessionGameTime } from './sessionRuntime.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';

/**
 * Composition root — geography / trade bounded context.
 *
 * @param {object} deps
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {ReturnType<import('./createAccountingContext.js').createAccountingContext>} deps.accounting
 */
export function createTradeContext({ supply, accounting }) {
  const cityTradeRepository = new DexieCityTradeRepository();

  const runMonthlyCityTradeCycle = new RunMonthlyCityTradeCycle({
    cityTradeRepository,
    supplyBuildingRepository: supply.supplyBuildingRepository,
    hubServing: supply.hubServing,
    // A hub's `goods` field is a shared total across every deal good it stores (see
    // buildingEconomy.js's TradeWarehouse) — keeping the category taken and that total in step is
    // the same supply-domain rule CollectResourceToHub already follows (ResourceStock.js);
    // geography gets it as a capability instead of importing across the bounded context.
    takeHubStock: (hub, category, amount) =>
      takeCategoryAmount(hub.stocks, category, amount, getCategoriesForRole(hub.type, 'hub'), getTotalKeyForRole(hub.type, 'hub')),
    recordMerchantSale: (params) => supply.recordMerchantSale(params),
    // The exporters and the importers are the merchant houses: their lines go on their business accounts, the duty on the city's.
    recordMerchantLine: async ({ houseId, ...line }) =>
      accounting.recordLedgerEntry({ ...line, accountBuildingId: houseId, accountKind: await accounting.businessAccountOfHouse(houseId, 'recipes') }),
    recordCityLine: (line) => accounting.recordLedgerEntry(line),
    recordImportDelivery: (params) => supply.recordImportDelivery(params),
    // What the warehouse sells a good at (its average cost plus its margin): the cost of what our merchants export.
    hubSellingPrice: (hub, good, period) => supply.sellingPriceOf(hub, good, period),
    producerOfLot: (lotKey) => supply.producerOfLot(lotKey),
    hubHolds: (hub, category) => getCategoriesForRole(hub.type, 'hub').includes(category),
    hubRoom: (hub) => Math.max(0, hub.maxStock - (hub.stocks[getTotalKeyForRole(hub.type, 'hub')] ?? 0)),
    // Same shape as takeHubStock: the category and the hub's shared total move together (ResourceStock.js).
    addHubStock: (hub, category, amount) =>
      addCategoryAmount(hub.stocks, category, amount, getCategoriesForRole(hub.type, 'hub'), getTotalKeyForRole(hub.type, 'hub')),
    // The duty a customs authority charges on one good for one flow, at a turn: an export's is read at each order's
    // sale, an import's at each delivery.
    // The duty in force: nil while nobody holds the collection of the customs (the player's rate stays set).
    getCustomsDuty: (authority, flow, good, turn) => accounting.getCustomsDutyInForce(authority, flow, good, turn),
    random: () => Math.random(),
    // Where a sale's range is centred. No game event moves it yet, so every sale is centred on 0 (no
    // favour, no hurt); events, the relation's state and the merchant's experience plug in here.
    saleBias: () => 0,
  });

  // The merchants make a deal only while a city is open to it: an import deal while an active city offers the good, an
  // export deal while an active city wants it; and not while the merchants ceased because the trade does not pay
  // (`unprofitable` / `export_unprofitable`). Deals already waiting, in the warehouses and in the merchant houses that made
  // them, must not exceed what the cities take in one order: more would only fill the warehouse (and, for exports,
  // consume real goods for nothing).
  supply.setOpenDealCheck(async (dealGood) => {
    const importCities = TRADE_CATALOG.filter((entry) => entry.offers.some((offer) => offer.merchantGood === dealGood));
    const exportCities = TRADE_CATALOG.filter((entry) => entry.wants.some((want) => want.merchantGood === dealGood));
    if (importCities.length === 0 && exportCities.length === 0) {
      throw new Error(`[trade] no city of the trade catalog offers or wants the good that "${dealGood}" is a deal for`);
    }
    const relations = new Map((await cityTradeRepository.getActiveRelations()).map((relation) => [relation.cityId, relation]));
    let perOrder = 0;
    for (const entry of importCities) {
      const offer = entry.offers.find((candidate) => candidate.merchantGood === dealGood);
      const ceased = relations.get(entry.cityId)?.importCeased[offer.good];
      if (relations.has(entry.cityId) && ceased?.reason !== 'unprofitable') perOrder += offer.quantityPerOrder;
    }
    for (const entry of exportCities) {
      const want = entry.wants.find((candidate) => candidate.merchantGood === dealGood);
      const ceased = relations.get(entry.cityId)?.exportCeased[want.good];
      if (relations.has(entry.cityId) && ceased?.reason !== 'export_unprofitable') perOrder += entry.trade.quantityPerOrder;
    }
    if (perOrder === 0) return false;
    const rows = await supply.supplyBuildingRepository.listAllBuildingRows();
    const waiting = rows.reduce((sum, row) => sum + (row.stocks?.[dealGood] ?? 0), 0);
    return waiting < perOrder;
  });

  return {
    cityTradeRepository,

    async openRelation(cityId, { startMonth }) {
      await cityTradeRepository.saveRelation({
        cityId,
        status: 'active',
        satisfactionScore: SATISFACTION_START,
        contractStartMonth: startMonth,
        contractEndMonth: null,
        lastOrderMonth: null,
        ceased: null,
        importCeased: {},
        importFailures: {},
        exportCeased: {},
        exportFailures: {},
      });
    },

    async getAllRelations() {
      return cityTradeRepository.getAllRelations();
    },

    async getRelation(cityId) {
      return cityTradeRepository.getRelation(cityId);
    },

    async runMonthlyCityTradeCycle(timeInfo) {
      return runMonthlyCityTradeCycle.execute(timeInfo);
    },

    /**
     * For each catalog city not yet in the DB, open the relation if
     * canOpenRelation passes. Safe to call every month — skips existing rows.
     * @param {{ monthIndex: number }} timeInfo
     */
    async checkAndOpenNewRelations({ monthIndex }) {
      for (const entry of TRADE_CATALOG) {
        const existing = await cityTradeRepository.getRelation(entry.cityId);
        if (existing) continue;
        const ok = await canOpenRelation(entry.cityId);
        if (!ok) continue;
        await cityTradeRepository.saveRelation({
          cityId: entry.cityId,
          status: 'active',
          satisfactionScore: SATISFACTION_START,
          contractStartMonth: monthIndex,
          contractEndMonth: null,
          lastOrderMonth: null,
          ceased: null,
          importCeased: {},
          importFailures: {},
          exportCeased: {},
          exportFailures: {},
        });
      }
    },

    /**
     * The price of each good that reaches the shelves, step by step (see buildPriceWaterfall): the imported goods one per offering city, the
     * goods made here when a warehouse and a market sell them. Read from the catalogs and the prices in force this month; nothing is stored.
     * @returns {Promise<ReturnType<typeof buildPriceWaterfall>[]>}
     */
    async getPriceWaterfalls() {
      const turn = getSessionGameTime();
      const period = resolveGetTimeInfo()(turn);
      const [selling, vatRates] = await Promise.all([supply.listSellingPrices(period), accounting.getVatRates()]);
      const average = (good, stage) => {
        const prices = selling.filter((row) => row.category === good && row.stage === stage).map((row) => row.price);
        return prices.length === 0 ? null : prices.reduce((sum, price) => sum + price, 0) / prices.length;
      };
      const vatOf = (good) => {
        if (vatRates[good] === undefined) throw new Error(`[price-waterfall] the hamlet has no VAT rate for "${good}"`);
        return vatRates[good];
      };

      const waterfalls = [];
      const imported = new Set();
      for (const entry of TRADE_CATALOG) {
        for (const offer of entry.offers) {
          imported.add(offer.good);
          const warehousePrice = average(offer.good, 'hub');
          if (warehousePrice === null) continue;
          const dutyRate = await accounting.getCustomsDutyInForce('anoria', 'import', offer.good, turn);
          const delivery = priceImportDelivery({ cityId: entry.cityId, offer, quantity: offer.quantityPerOrder, dutyRate });
          waterfalls.push(buildPriceWaterfall({
            good: offer.good,
            reference: getResourceBaseValue(offer.good),
            producerPrice: unitPriceAtStage('producer', offer.good),
            import: {
              cityId: entry.cityId,
              cityPrice: delivery.unit.foreign,
              transport: delivery.unit.transport,
              dutyRate,
              duty: delivery.unit.duty,
              merchantMargin: delivery.unit.margin,
            },
            warehousePrice,
            marketPrice: average(offer.good, 'distributor'),
            vatPercent: vatOf(offer.good),
          }));
        }
      }
      for (const good of new Set(selling.filter((row) => row.stage === 'distributor').map((row) => row.category))) {
        if (imported.has(good)) continue;
        const warehousePrice = average(good, 'hub');
        // What the producers of it really sell it at (their cost plus their margin); no producer built, no step to show.
        const producerPrice = average(good, 'producer');
        if (warehousePrice === null || producerPrice === null) continue;
        waterfalls.push(buildPriceWaterfall({
          good,
          reference: getResourceBaseValue(good),
          producerPrice,
          import: null,
          warehousePrice,
          marketPrice: average(good, 'distributor'),
          vatPercent: vatOf(good),
        }));
      }
      return waterfalls;
    },

    /**
     * Trade summary for one city — relation state + all historical sales.
     * @param {string} cityId
     * @returns {Promise<{ relation: object|null, entry: object|null, sales: object[] }>}
     */
    async getCityTradeInfo(cityId) {
      const [relation, sales] = await Promise.all([
        cityTradeRepository.getRelation(cityId),
        supply.getMerchantSalesForCity(cityId),
      ]);
      return { relation: relation ?? null, entry: getTradeCatalogEntry(cityId), sales };
    },
  };
}

/** @type {ReturnType<typeof createTradeContext> | null} */
let sharedTrade = null;

/**
 * @param {Parameters<typeof createTradeContext>[0]} deps
 */
export function getOrCreateTradeContext(deps) {
  if (!sharedTrade) {
    sharedTrade = createTradeContext(deps);
  }
  return sharedTrade;
}

/** @internal Tests only */
export function resetTradeContextForTests() {
  sharedTrade = null;
}
