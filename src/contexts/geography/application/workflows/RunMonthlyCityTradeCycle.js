import { getTradeCatalogEntry } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { getResourceBaseValue } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { reviewSatisfaction } from '../../domain/policies/TradeSatisfactionPolicy.js';

/**
 * Monthly city-trade cycle — for each active relation whose order rhythm is
 * due, consume deal goods from warehouses, credit customs revenue to treasury,
 * and record a merchant_sale traceability entry.
 *
 * A trade city is a client of the TradeWarehouse hub exactly like a market or workshop is a client
 * of a goods warehouse: goods are taken through `hubServing` (id `city:<cityId>`), so a merchant
 * instance's own saved client priority — same board, same engine as any building client — decides
 * which city gets served first the day more than one wants the same deal good (see
 * createSupplyContext.js's `listExternalClientsForCategory`, the one place this is wired in).
 *
 * One instance per game session; injected with ports so the geography context
 * stays decoupled from supply and accounting internals.
 */
export class RunMonthlyCityTradeCycle {
  /**
   * @param {{
   *   cityTradeRepository: import('../../infrastructure/dexie/DexieCityTradeRepository.js').DexieCityTradeRepository,
   *   supplyBuildingRepository: { findByResourceRole: Function, saveStocks: Function },
   *   hubServing: import('../../../supply/application/services/HubServing.js').HubServing,
   *   takeHubStock: (hub: object, category: string, amount: number) => object,
   *   recordCommerceExportIncome: (params: { turn: number, amount: number, description: string, productId: string, partnerId: string }) => Promise<unknown>,
   *   recordMerchantSale: (params: object) => Promise<void>,
   *   getCustomsRate: () => number,
   *   random: () => number, // a draw in [0, 1): the sale's position in its range
   *   saleBias: (sale: { cityId: string, good: string, relation: object }) => number, // [-1, 1]: where the range is centred
   * }} deps
   */
  constructor({ cityTradeRepository, supplyBuildingRepository, hubServing, takeHubStock, recordCommerceExportIncome, recordMerchantSale, getCustomsRate, random, saleBias }) {
    this.repo = cityTradeRepository;
    this.supplyRepo = supplyBuildingRepository;
    this.hubServing = hubServing;
    // The hub's next stock object after taking `amount` of `category` — keeping the good AND the
    // hub's shared total in step is a supply-domain fact (ResourceStock.js/ResourceRolePolicy.js);
    // geography stays decoupled from it by taking it as a capability, like every other supply/
    // accounting effect here, rather than importing across the bounded context.
    this.takeHubStock = takeHubStock;
    this.recordIncome = recordCommerceExportIncome;
    this.recordMerchantSale = recordMerchantSale;
    this.getCustomsRate = getCustomsRate;
    this.random = random;
    this.saleBias = saleBias;
  }

  /**
   * The ratio a sale is made at, on the want's baseMultiplier. The draw picks a point in a range
   * centred on `saleBias` (events, the relation, the merchant's experience move it: +1 favours the
   * merchant, -1 hurts) and `drawWidth` wide; the ratio moves at most `spread` either side of the centre.
   * A bias or a draw that is not a number throws: no stand-in ratio.
   */
  #drawSaleRatio(entry, want, relation) {
    const bias = this.saleBias({ cityId: relation.cityId, good: want.good, relation });
    if (!Number.isFinite(bias)) throw new Error(`[trade] saleBias returned ${bias} for ${want.good}, expected a number`);
    const draw = this.random();
    if (!(draw >= 0 && draw < 1)) throw new Error(`[trade] random() returned ${draw}, expected a number in [0, 1)`);
    const centre = Math.max(-1, Math.min(1, bias));
    const position = Math.max(-1, Math.min(1, centre + (2 * draw - 1) * entry.sale.drawWidth));
    return want.baseMultiplier * (1 + entry.sale.spread * position);
  }

  /**
   * @param {{ turn: number, monthIndex: number, monthNumber: number, year: number }} timeInfo
   */
  async execute(timeInfo) {
    const { monthIndex, monthNumber, year } = timeInfo;
    // TimeCalendar's timeInfo carries `days`, not `turn` (RunMonthlyResourceCycle reads it the same way);
    // an undefined turn made recordClientDemand throw AFTER the stock was already taken.
    const turn = timeInfo.turn ?? timeInfo.days ?? 0;
    // The rhythm below needs a month count that only ever goes up. `monthIndex` is the calendar
    // month WITHIN the current year (0-11, wraps every 12) — using it here made a relation whose
    // `lastOrderMonth` fell late in a year (e.g. 10, November) get stuck forever the moment the
    // year rolled over: `monthIndex - lastOrder` goes negative and can never reach `frequencyMonths`
    // again within a 0-11 range, so it never orders again (a real city sat at "Commerce actif" with
    // a stuck score, `RunMonthlyCityTradeCycle` silently never revisiting it — no error, just no
    // trade). `monthNumber` (TimeCalendar.js) is the same clock's ever-increasing absolute month
    // count and does not have this wraparound.
    const orderMonth = Number.isFinite(monthNumber) ? monthNumber : monthIndex;
    const relations = await this.repo.getActiveRelations();
    if (relations.length === 0) return;

    const customsRate = this.getCustomsRate();
    // Deal goods are only accepted by TradeWarehouse (regular Warehouse excludes them),
    // so querying all hubs is safe: only TradeWarehouse buildings will hold these goods.
    const hubs = await this.supplyRepo.findByResourceRole('hub');

    // Rhythm check: is this an order month?
    for (const relation of relations) {
      const entry = getTradeCatalogEntry(relation.cityId);
      if (!entry) continue;

      const lastOrder = relation.lastOrderMonth ?? (orderMonth - entry.trade.frequencyMonths);
      if (orderMonth - lastOrder < entry.trade.frequencyMonths) continue;

      let totalRevenue = 0;
      let anySold = false;

      const client = `city:${relation.cityId}`;

      for (const want of entry.wants) {
        const dealGood = want.merchantGood;
        if (!dealGood) continue;

        const baseValue = getResourceBaseValue(want.good);

        const qty = await this.#takeFromHubsForClient(hubs, dealGood, client, entry.trade.quantityPerOrder, turn);
        if (qty <= 0) continue;

        const saleRatio = this.#drawSaleRatio(entry, want, relation);
        const unitPrice = baseValue * saleRatio;
        const grossRevenue = qty * unitPrice;
        const customsCollected = Math.round(grossRevenue * customsRate);
        const netRevenue = Math.round(grossRevenue * (1 - customsRate));
        totalRevenue += customsCollected;

        await this.recordIncome({
          turn,
          amount: customsCollected,
          description: `Douane export ${want.good} → ${relation.cityId} (${qty} unités × ${Math.round(customsRate * 100)}%)`,
          productId: want.good,
          partnerId: relation.cityId,
        });

        await this.recordMerchantSale({
          turn,
          monthIndex,
          year,
          cityId: relation.cityId,
          good: want.good,
          dealGood,
          quantity: qty,
          unitPrice,
          saleRatio,
          grossRevenue,
          netRevenue,
          customsCollected,
          customsRate,
        });

        anySold = true;
      }

      // Satisfaction: +2 if sold something, -5 if order month but nothing available
      relation.satisfactionScore = reviewSatisfaction(relation.satisfactionScore, entry.satisfaction, { sold: anySold });
      relation.lastOrderMonth = orderMonth;
      await this.repo.saveRelation(relation);
    }
  }

  /**
   * Take up to `qty` units of `good` for `client` (a city, `city:<cityId>`) across every hub that
   * might hold it, through `hubServing` so a merchant instance's own client-priority setting for
   * this good — the same one that ranks a market or workshop — is respected: a hub whose lots the
   * merchant ranked this city above (or below) another client behaves exactly the same way here.
   *
   * Two things this must NOT do, both real bugs the first version had:
   *  - assign onto the hub snapshot's own `.stocks` — `findByResourceRole` returns `Object.freeze`d
   *    rows (SupplyBuildingSnapshot.js), so `hub.stocks = x` throws ("Cannot assign to read only
   *    property") the moment a sale is actually possible — which it never was until the collection
   *    and rhythm bugs above were fixed, so this was latent since the file was written, not new.
   *    Because it throws AFTER `saveStocks` already persisted the deduction, the goods really did
   *    leave the hub — no error surfaced to the player, just a sale that never got recorded, forever.
   *  - replace `.stocks` wholesale — a hub's `goods` field is a shared total across every deal good
   *    it stores (see buildingEconomy.js's TradeWarehouse); only touching the one category being
   *    sold, the way the first version did, leaves that total permanently too high, which eventually
   *    makes `CollectResourceToHub`'s capacity check see the hub as full forever and silently stop
   *    all further collection — `takeCategoryAmount` (the same helper CollectResourceToHub already
   *    uses) keeps the category and the total in step instead.
   * @returns {Promise<number>} Units actually taken (may be less than `qty` if none is available or
   *   a higher-ranked client is still owed some).
   */
  async #takeFromHubsForClient(hubs, good, client, qty, turn) {
    let remaining = qty;
    for (let index = 0; index < hubs.length; index += 1) {
      if (remaining <= 0) break;
      const hub = hubs[index];
      const available = await this.hubServing.availableTo(hub, good, client, turn);
      const want = Math.min(available, remaining);
      if (want <= 0) continue;

      const takes = await this.hubServing.take({ hubId: hub.id, category: good, client, amount: want, turn });
      const takenHere = takes.reduce((sum, take) => sum + take.amount, 0);
      if (takenHere <= 0) continue;

      const nextStock = this.takeHubStock(hub, good, takenHere);
      await this.supplyRepo.saveStocks(hub.id, nextStock);
      // Not a mutation of the frozen snapshot: a fresh object replacing this hub's slot, so a
      // later want/relation in this same pass (or a future second city wanting the same good)
      // sees the stock this take just left, not the stale figure the tick started with.
      hubs[index] = { ...hub, stocks: nextStock };
      await this.hubServing.recordDemand({ hubId: hub.id, category: good, client, turn, wanted: want, served: takenHere });

      remaining -= takenHere;
    }
    return qty - remaining;
  }
}
