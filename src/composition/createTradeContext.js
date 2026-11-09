import { DexieCityTradeRepository } from '../contexts/geography/infrastructure/dexie/DexieCityTradeRepository.js';
import { RunMonthlyCityTradeCycle } from '../contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { DexieRelationEventRepository } from '../contexts/geography/infrastructure/dexie/DexieRelationEventRepository.js';
import { MakeDiplomaticGift } from '../contexts/geography/application/workflows/MakeDiplomaticGift.js';
import { readRelation } from '../contexts/geography/domain/policies/RelationMemoryPolicy.js';
import { getDaysPerMonth } from '../config/events.js';
import { turnsPerYear } from '../shared/time/TimeCalendar.js';
import { WorldMarket } from '../contexts/geography/application/services/WorldMarket.js';
import { WorldMarketRepository } from '../contexts/geography/infrastructure/dexie/WorldMarketRepository.js';
import { isClimateCrop } from '../shared/climate/ClimatePolicy.js';
import { TRADE_CATALOG, DIPLOMATIC_GESTURES, characterWordsOf, getTradeCatalogEntry, listTradedGoodIds } from '../shared/trade-catalog/TradeCatalog.js';
import { canOpenRelation } from '../contexts/geography/application/canOpenRelation.js';
import { getCategoriesForRole, getTotalKeyForRole } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { addCategoryAmount, takeCategoryAmount } from '../contexts/supply/domain/value-objects/ResourceStock.js';
import { buildPriceWaterfall } from '../contexts/geography/domain/policies/PriceWaterfallPolicy.js';
import { importPaysAtHome, priceImportDelivery } from '../contexts/geography/domain/policies/ImportPricePolicy.js';
import { getResourceBaseValue } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import { unitPriceAtStage } from '../shared/resource-catalog/ValueChainCatalog.js';
import { goodSatisfactionOf, openingGoodReview, openingGoodSatisfaction, relationSatisfaction, saleBiasOf, satisfactionTier } from '../shared/trade-catalog/satisfaction.js';
import { getWorldCityById } from './worldCityCatalog.js';
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
  const relationEventRepository = new DexieRelationEventRepository();
  // The gifts the city makes to a partner (a gesture of the relation): paid by the State's own journal line, then written in the relation's journal.
  const diplomaticGift = new MakeDiplomaticGift({
    relationEvents: relationEventRepository,
    recordCityLine: (line) => accounting.recordLedgerEntry(line),
    now: () => {
      const turn = getSessionGameTime();
      const { year, monthIndex } = resolveGetTimeInfo()(turn);
      return { turn, year, monthIndex };
    },
    daysPerMonth: getDaysPerMonth,
    cityName: (cityId) => {
      const name = getWorldCityById(cityId)?.name;
      if (!name) throw new Error(`[trade] the world has no city "${cityId}" to name in a gift`);
      return name;
    },
  });

  // The world's prices (WorldMarket.js): what the cities pay and ask moves with them, and a harvest of the world's own sets the crops'.
  const worldMarket = new WorldMarket({
    repository: new WorldMarketRepository(),
    goods: listTradedGoodIds(),
    isCrop: isClimateCrop,
    worldClimateOfYear: (year) => supply.getWorldClimateOfYear(year),
    random: () => Math.random(),
  });
  const runMonthlyCityTradeCycle = new RunMonthlyCityTradeCycle({
    worldIndexOf: (good, period) => worldMarket.indexOf(good, period),
    homePriceOf: (good, period) => homeShelfPriceOf(good, period),
    cityTradeRepository,
    relationEvents: relationEventRepository,
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
    // Where a sale's range is centred: on the good's commercial satisfaction with the city (warm: the partner pays more, cold: less). Events and the
    // merchant's experience plug in here later.
    saleBias: ({ good, relation }) => saleBiasOf(goodSatisfactionOf(relation, 'export', good)),
  });

  // The merchants make a deal only while a city is open to it: an import deal while an active city offers the good, an
  // export deal while an active city wants it; and not while the merchants ceased because the trade does not pay
  // (`unprofitable` / `export_unprofitable`). Deals already waiting, in the warehouses and in the merchant houses that made
  // them, must not exceed what the cities take in one order: more would only fill the warehouse (and, for exports,
  // consume real goods for nothing).
  // A good the city makes itself is imported only while buying it abroad is cheaper than the market's price at home (importPaysAtHome): the landed price of the offer
  // (the world's price of the month, the freight, the duty, the merchants' margin) against the average shelf price now, which carries the scarcity. Read once a month per city.
  const homePriceByMonth = new Map();
  /** The average shelf price now of a good the city makes itself (the reference chain's while no market sells it yet); null for a good it does not make. */
  const homeShelfPriceOf = async (good, period) => {
    const scarce = new Set((await supply.describeScarcity()).flatMap((need) => need.categories));
    if (!scarce.has(good)) return null;
    const cacheKey = `${good}|${period.year}|${period.monthIndex}`;
    if (!homePriceByMonth.has(cacheKey)) {
      const shelf = (await supply.listSellingPrices(period)).filter((row) => row.category === good && row.stage === 'distributor').map((row) => row.price);
      homePriceByMonth.set(cacheKey, shelf.length > 0 ? shelf.reduce((sum, price) => sum + price, 0) / shelf.length : unitPriceAtStage('distributor', good));
    }
    return homePriceByMonth.get(cacheKey);
  };
  const importIsWorthwhile = async (entry, offer) => {
    const turn = getSessionGameTime();
    const period = resolveGetTimeInfo()(turn);
    const dutyRate = await accounting.getCustomsDutyInForce('anoria', 'import', offer.good, turn);
    const delivery = priceImportDelivery({ cityId: entry.cityId, offer, quantity: offer.quantityPerOrder, dutyRate, worldIndex: await worldMarket.indexOf(offer.good, period) });
    return importPaysAtHome({ landedUnitSale: delivery.unit.sale, localUnitPrice: await homeShelfPriceOf(offer.good, period) });
  };
  supply.setOpenDealCheck(async (dealGood) => {
    const importCities = TRADE_CATALOG.filter((entry) => entry.offers.some((offer) => offer.merchantGood === dealGood));
    const exportCities = TRADE_CATALOG.filter((entry) => entry.wants.some((want) => want.merchantGood === dealGood));
    if (importCities.length === 0 && exportCities.length === 0) {
      throw new Error(`[trade] no city of the trade catalog offers or wants the good that "${dealGood}" is a deal for`);
    }
    const scarceGoods = new Set((await supply.describeScarcity()).flatMap((need) => need.categories));
    const relations = new Map((await cityTradeRepository.getActiveRelations()).map((relation) => [relation.cityId, relation]));
    let perOrder = 0;
    for (const entry of importCities) {
      const offer = entry.offers.find((candidate) => candidate.merchantGood === dealGood);
      const ceased = relations.get(entry.cityId)?.importCeased[offer.good];
      if (!relations.has(entry.cityId) || ceased?.reason === 'unprofitable') continue;
      // What the city makes itself is imported only when the home price is dearer (a shortage, a dear harvest); coal and the like have no home price to beat.
      if (scarceGoods.has(offer.good) && !(await importIsWorthwhile(entry, offer))) continue;
      perOrder += offer.quantityPerOrder;
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
    /** The world price index of every traded good in the month of a period (WorldMarket.js): around 1, drifting. @param {{ year: number, monthIndex: number }} period */
    getWorldPrices(period) {
      return worldMarket.indicesAt(period);
    },

    cityTradeRepository,

    async openRelation(cityId, { startMonth }) {
      const entry = getTradeCatalogEntry(cityId);
      if (!entry) throw new Error(`[trade] "${cityId}" is not in the trade catalog: no relation can be opened with it`);
      await cityTradeRepository.saveRelation({
        cityId,
        status: 'active',
        goodSatisfaction: openingGoodSatisfaction(entry),
        goodReview: openingGoodReview(),
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
          goodSatisfaction: openingGoodSatisfaction(entry),
          goodReview: openingGoodReview(),
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
          const delivery = priceImportDelivery({ cityId: entry.cityId, offer, quantity: offer.quantityPerOrder, dutyRate, worldIndex: await worldMarket.indexOf(offer.good, period) });
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
     * What there is to know of the trade with one city: the single reading that the admin panel's card and sheet and the world map all use, so they never disagree.
     * Read from the stored relation, the catalog and the duties in force; nothing is stored here. A city with no entry in the trade catalog (or with no relation yet) says so
     * (`status: 'none'`, no goods), it is not given a made-up relation.
     * @param {string} cityId
     * @returns {Promise<{
     *   cityId: string, name: string | null, status: 'none' | 'active' | 'suspended' | 'expired', satisfaction: number | null, satisfactionTier: string | null, ceased: object | null,
     *   goods: Array<{ good: string, flow: 'export' | 'import', ceased: object | null, ourDuty: number, priceRange: { low: number, high: number } | null,
     *     satisfaction: number | null, satisfactionTier: string | null, review: Record<string, number> | null }>,
     *   character: string[], relationScore: number | null, relationTier: string | null, relationEvents: Array<object>, // the partner's character in words, and the memory of the relation
     *   relation: object | null, entry: object | null, sales: object[],
     * }>}
     */
    async describeTradeRelation(cityId) {
      const base = await this.getCityTradeInfo(cityId);
      const { entry, relation } = base;
      // The duties are those in force at the running turn: the sheet is read in a game that runs.
      const turn = getSessionGameTime();
      // The climate of each exchange (its satisfaction, its step, what the last review gave), none while no relation is open; `review` is null until the good has had its first order.
      const climateOf = (flow, good) => {
        if (!relation) return { satisfaction: null, satisfactionTier: null, review: null };
        const satisfaction = goodSatisfactionOf(relation, flow, good);
        return { satisfaction, satisfactionTier: satisfactionTier(satisfaction), review: relation.goodReview[flow][good] ?? null };
      };
      const goods = [];
      for (const want of entry?.wants ?? []) {
        // A good the city wants but that no merchant house deals in (no `merchantGood`) is never traded: it is not an exchange to show.
        if (!want.merchantGood) continue;
        const centre = getResourceBaseValue(want.good) * want.baseMultiplier;
        goods.push({
          good: want.good,
          flow: 'export',
          ceased: relation?.exportCeased[want.good] ?? null,
          ourDuty: await accounting.getCustomsDutyInForce('anoria', 'export', want.good, turn),
          priceRange: { low: centre * (1 - entry.sale.spread), high: centre * (1 + entry.sale.spread) },
          ...climateOf('export', want.good),
        });
      }
      for (const offer of entry?.offers ?? []) {
        goods.push({
          good: offer.good,
          flow: 'import',
          ceased: relation?.importCeased[offer.good] ?? null,
          ourDuty: await accounting.getCustomsDutyInForce('anoria', 'import', offer.good, turn),
          priceRange: null,
          ...climateOf('import', offer.good),
        });
      }
      // The memory of the relation: read from the journal of its events at the running turn, faded by the partner's memory. Nothing is stored.
      const memory = relation
        ? readRelation({ events: await relationEventRepository.listOf(cityId), entry, nowTurn: turn, turnsPerYear: turnsPerYear(getDaysPerMonth()) })
        : null;
      // The gift gesture: its rule, and how many months to wait before it can be made again (null: now).
      const giftReadyAt = relation ? await diplomaticGift.readyAtTurn(cityId) : null;
      return {
        ...base,
        goods,
        gift: relation ? { ...DIPLOMATIC_GESTURES.gift, readyInMonths: giftReadyAt === null ? null : Math.ceil((giftReadyAt - turn) / getDaysPerMonth()) } : null,
        character: entry ? characterWordsOf(entry) : [],
        relationScore: memory?.score ?? null,
        relationTier: memory?.tier ?? null,
        relationEvents: memory?.events ?? [],
      };
    },

    /**
     * The city gives a partner `amount` € to mend the relation (MakeDiplomaticGift.js). A refusal comes back with its reason; a city with no open relation throws.
     * @param {string} cityId @param {number} amount
     */
    async makeGift(cityId, amount) {
      const entry = getTradeCatalogEntry(cityId);
      if (!entry || !(await cityTradeRepository.getRelation(cityId))) throw new Error(`[trade] no relation is open with "${cityId}": nothing to give a gift to`);
      return diplomaticGift.execute({ entry, amount });
    },

    /** The reading of every city of the trade catalog (the cards of the admin panel). */
    async describeTradeRelations() {
      return Promise.all(TRADE_CATALOG.map((entry) => this.describeTradeRelation(entry.cityId)));
    },

    /**
     * The base of the reading of a city's trade — its relation, its state, its satisfaction, what stopped it, its sales — which needs no running game: the world map reads it,
     * and `describeTradeRelation` (the admin panel's) is this plus the goods, so they are one reading and never disagree. A city with no entry in the trade catalog, or
     * with no relation yet, says so (`status: 'none'`); it is not given a made-up relation.
     * @param {string} cityId
     */
    async getCityTradeInfo(cityId) {
      const entry = getTradeCatalogEntry(cityId);
      const [relation, sales] = await Promise.all([cityTradeRepository.getRelation(cityId), supply.getMerchantSalesForCity(cityId)]);
      if (relation && (!relation.exportCeased || !relation.importCeased)) {
        throw new Error(`[trade] the relation with ${cityId} holds no exportCeased/importCeased: it was not opened by this version`);
      }
      return {
        cityId,
        name: getWorldCityById(cityId)?.name ?? null,
        status: relation?.status ?? 'none',
        satisfaction: relation ? relationSatisfaction(relation, entry) : null,
        satisfactionTier: relation ? satisfactionTier(relationSatisfaction(relation, entry)) : null,
        ceased: relation?.ceased ?? null,
        relation: relation ?? null,
        entry,
        sales,
      };
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
