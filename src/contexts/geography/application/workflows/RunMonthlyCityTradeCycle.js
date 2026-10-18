import { getTradeCatalogEntry } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { getResourceBaseValue } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { unitPriceAtStage } from '../../../../shared/resource-catalog/ValueChainCatalog.js';
import { reviewSatisfaction } from '../../domain/policies/TradeSatisfactionPolicy.js';
import { priceImportDelivery } from '../../domain/policies/ImportPricePolicy.js';
import { findCeaseReason } from '../../domain/policies/TradeCeasePolicy.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/** Splits `total` between shares in proportion to their weights, to the centime; the last share takes what is left. */
function splitByWeight(total, weights) {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  let given = 0;
  return weights.map((weight, index) => {
    const part = index === weights.length - 1 ? centimes(total - given) : centimes((total * weight) / sum);
    given = centimes(given + part);
    return part;
  });
}

/**
 * Monthly city-trade cycle — for each active relation whose order rhythm is due, our merchants export against the
 * deals they hold and import against the deals they hold. Exports and imports are parallel and never mixed: their own
 * deals, their own journal lines, their own duty (each good has one per flow), their own reasons to cease.
 *
 * EXPORT. Each export deal (a deal good in a trade warehouse) was made by a merchant house from goods it bought from a
 * warehouse at the value chain's hub price. At the city's order month the deals are consumed and the goods sold to the
 * city at its drawn price (a range around the want's multiplier, moved by `saleBias`). Each merchant house, in
 * proportion to its deals, is credited the sale on its business account (`abroad_sale_<good>`) and pays Anoria's export
 * duty on it (`duty_paid_export_<good>`); the city receives the duty (`export_<good>`). The buying city pays the freight.
 *
 * IMPORT. Against the deals our merchants hold, the city delivers what it OFFERS: each deal is consumed and becomes the
 * real good, filed in a warehouse that has room under the city that sent it (`city:<cityId>`). The merchant houses who
 * made the deals are the importers: each pays, on its own business account, the city's price (`import_<good>`), the
 * transport (`freight_<good>`) and Anoria's import duty (`duty_paid_import_<good>`, received by the city as
 * `customs_import_<good>`), and sells the goods to the warehouse at that cost plus its margin (the month's settlement
 * turns the traceability row into the sale and the purchase). See ImportPricePolicy for the price.
 *
 * Both flows stop on declared reasons (TradeCeasePolicy): the city's end the whole relation, our merchants' pause one
 * good of one flow, with the reason kept on the relation (`exportCeased`, `importCeased`) and lifted when it no longer holds.
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
   *   recordMerchantSale: (params: object) => Promise<void>,
   *   getCustomsDuty: (authority: string, flow: 'import' | 'export', good: string, turn: number) => number | Promise<number>,
   *   recordMerchantLine: (params: { turn: number, type: string, amount: number, description: string, partnerId: string, houseId: string, dutyRate?: number, customsBase?: number }) => Promise<{ recorded: boolean, reason?: string }>, // a merchant house's business account
   *   recordCityLine: (params: { turn: number, type: string, amount: number, description: string, partnerId: string, dutyRate?: number, customsBase?: number }) => Promise<{ recorded: boolean, reason?: string }>, // the city's own account
   *   recordImportDelivery: (params: { turn: number, monthIndex: number, year: number, houseId: string, hubId: string, good: string, quantity: number, unitPrice: number }) => Promise<void>, // the merchants' sale to the warehouse, for the month's settlement
   *   hubSellingPrice: (hub: object, good: string, period: { year: number, monthIndex: number }) => Promise<number>, // what a warehouse sells a good at this month
   *   producerOfLot: (lotKey: string) => string | null, // the building that made the goods of a hub's lot
   *   hubHolds: (hub: object, category: string) => boolean, // the hub's catalog entry lists this good
   *   hubRoom: (hub: object) => number, // units the hub can still take
   *   addHubStock: (hub: object, category: string, amount: number) => object, // the hub's next stock after receiving
   *   random: () => number, // a draw in [0, 1): the sale's position in its range
   *   saleBias: (sale: { cityId: string, good: string, relation: object }) => number, // [-1, 1]: where the range is centred
   * }} deps
   */
  constructor({ cityTradeRepository, supplyBuildingRepository, hubServing, takeHubStock, recordMerchantSale, getCustomsDuty, recordMerchantLine, recordCityLine, recordImportDelivery, hubSellingPrice, producerOfLot, hubHolds, hubRoom, addHubStock, random, saleBias }) {
    if (typeof hubSellingPrice !== 'function') throw new Error('[trade] the cycle needs the warehouses\' selling price (hubSellingPrice): it prices what the merchants export');
    this.hubSellingPrice = hubSellingPrice;
    this.repo = cityTradeRepository;
    this.supplyRepo = supplyBuildingRepository;
    this.hubServing = hubServing;
    // The hub's next stock object after taking `amount` of `category` — keeping the good AND the
    // hub's shared total in step is a supply-domain fact (ResourceStock.js/ResourceRolePolicy.js);
    // geography stays decoupled from it by taking it as a capability, like every other supply/
    // accounting effect here, rather than importing across the bounded context.
    this.takeHubStock = takeHubStock;
    this.recordMerchantSale = recordMerchantSale;
    this.getCustomsDuty = getCustomsDuty;
    this.recordMerchantLine = recordMerchantLine;
    this.recordCityLine = recordCityLine;
    this.recordImportDelivery = recordImportDelivery;
    this.producerOfLot = producerOfLot;
    this.hubHolds = hubHolds;
    this.hubRoom = hubRoom;
    this.addHubStock = addHubStock;
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

    // Deal goods are only accepted by TradeWarehouse (regular Warehouse excludes them),
    // so querying all hubs is safe: only TradeWarehouse buildings will hold these goods.
    const hubs = await this.supplyRepo.findByResourceRole('hub');

    // Rhythm check: is this an order month?
    for (const relation of relations) {
      const entry = getTradeCatalogEntry(relation.cityId);
      if (!entry) continue;

      // The city itself stops dealing (its confidence is gone, or the contract ran out): the whole relation ends.
      const cityCeases = findCeaseReason('relation', { relation, entry, orderMonth });
      if (cityCeases) {
        relation.status = 'expired';
        relation.ceased = { ...cityCeases, turn };
        await this.repo.saveRelation(relation);
        continue;
      }

      const lastOrder = relation.lastOrderMonth ?? (orderMonth - entry.trade.frequencyMonths);
      if (orderMonth - lastOrder < entry.trade.frequencyMonths) continue;

      let anySold = false;
      for (const want of entry.wants) {
        if (!want.merchantGood) continue;
        if (await this.#runWant({ relation, entry, hubs, want, turn, monthIndex, year })) anySold = true;
      }

      // What the city sells us, against the deals our merchants hold.
      let anyBought = false;
      for (const offer of entry.offers) {
        if (await this.#runOffer({ relation, entry, hubs, offer, turn, monthIndex, year })) anyBought = true;
      }

      // Satisfaction: +2 if a trade took place (a sale or a purchase), -5 if order month but nothing happened
      relation.satisfactionScore = reviewSatisfaction(relation.satisfactionScore, entry.satisfaction, { sold: anySold || anyBought });
      relation.lastOrderMonth = orderMonth;
      await this.repo.saveRelation(relation);
    }
  }

  /**
   * One want of the city at an order month: what our merchants hold as export deals decide the quantity; their cost, the
   * duty and the city's price (at the centre of its range) decide whether they keep exporting (TradeCeasePolicy,
   * `export_*` reasons). The reason is kept on the relation under `exportCeased`, apart from the imports', and lifted the
   * first order month it no longer holds.
   * @returns {Promise<boolean>} Whether anything was sold.
   */
  async #runWant({ relation, entry, hubs, want, turn, monthIndex, year }) {
    const cityId = relation.cityId;
    const good = want.good;
    if (!relation.exportCeased || !relation.exportFailures) {
      throw new Error(`[trade] the relation with ${cityId} holds no exportCeased/exportFailures: it was not opened by this version`);
    }
    const dealHubs = hubs.filter((hub) => this.hubHolds(hub, want.merchantGood));
    const waiting = dealHubs.reduce((sum, hub) => sum + (hub.stocks[want.merchantGood] ?? 0), 0);

    const before = relation.exportFailures[good] ?? {};
    const next = (reason, holds) => (waiting === 0 && holds ? (before[reason] ?? 0) + 1 : 0);
    const failures = {
      export_no_merchants: next('export_no_merchants', dealHubs.length > 0),
      export_no_warehouse: next('export_no_warehouse', dealHubs.length === 0),
    };
    relation.exportFailures = { ...relation.exportFailures, [good]: failures };

    const dutyRate = await this.getCustomsDuty('anoria', 'export', good, turn);
    // What our merchants paid for a unit (the warehouse's price), against what the city pays at the centre of its range,
    // duty taken off. The freight is the buying city's.
    // The warehouse's price is built on what its stock cost it (the average price of its deliveries, plus its margin), so a dearer import
    // upstream makes the merchants' export dearer too. They buy where it is cheapest. With no warehouse holding the good, nothing can be
    // bought at all and the reference chain's price stands in the test (the cease reasons about warehouses say why the trade is stopped).
    const holders = hubs.filter((hub) => this.hubHolds(hub, good));
    const cost = holders.length > 0
      ? Math.min(...(await Promise.all(holders.map((hub) => this.hubSellingPrice(hub, good, { year, monthIndex })))))
      : unitPriceAtStage('hub', good);
    const exportPricing = {
      unitNet: getResourceBaseValue(good) * want.baseMultiplier * (1 - dutyRate),
      unitCost: cost,
    };
    const ceases = findCeaseReason('export', { exportPricing, failures });
    const ceasedBefore = relation.exportCeased[good] ?? null;
    if (ceases) {
      if (ceasedBefore?.reason !== ceases.reason) relation.exportCeased = { ...relation.exportCeased, [good]: { ...ceases, turn } };
      return false;
    }
    if (ceasedBefore) {
      const { [good]: _lifted, ...stillCeased } = relation.exportCeased;
      relation.exportCeased = stillCeased;
    }
    if (waiting <= 0) return false;

    return this.#sell({ relation, entry, hubs, want, dutyRate, quantity: Math.min(entry.trade.quantityPerOrder, waiting), turn, monthIndex, year });
  }

  /**
   * Consume the export deals and sell the goods to the city. Each merchant house is credited its share of the sale and
   * pays its share of the duty; the city receives the whole duty. A refused journal line throws.
   */
  async #sell({ relation, entry, hubs, want, dutyRate, quantity, turn, monthIndex, year }) {
    const cityId = relation.cityId;
    const good = want.good;
    const { taken, byHub, lots } = await this.#takeFromHubsForClient(hubs, want.merchantGood, `city:${cityId}`, quantity, turn);
    if (taken <= 0) return false;

    const saleRatio = this.#drawSaleRatio(entry, want, relation);
    const unitPrice = getResourceBaseValue(good) * saleRatio;
    const gross = centimes(taken * unitPrice);
    const duty = centimes(gross * dutyRate);

    const unitsByHouse = new Map();
    for (const lot of lots) {
      const houseId = this.producerOfLot(lot.key);
      if (!houseId) throw new Error(`[trade] the deal lot "${lot.key}" names no merchant house`);
      unitsByHouse.set(houseId, (unitsByHouse.get(houseId) ?? 0) + lot.amount);
    }
    const houses = [...unitsByHouse.entries()].map(([houseId, units]) => ({ houseId, units }));
    const weights = houses.map((house) => house.units);
    const grossOf = splitByWeight(gross, weights);
    const dutyOf = splitByWeight(duty, weights);

    const book = (result, what) => {
      if (!result?.recorded) throw new Error(`[trade] the journal refused ${what}: ${result?.reason ?? 'no reason given'}`);
    };
    for (const [index, house] of houses.entries()) {
      const lines = [
        { type: `abroad_sale_${good}`, amount: grossOf[index], description: `Vente export ${good} → ${cityId} (${house.units} unités)` },
        { type: `duty_paid_export_${good}`, amount: dutyOf[index], description: `Douane export ${good} → ${cityId} (${house.units} unités × ${Math.round(dutyRate * 100)}%)`, dutyRate, customsBase: grossOf[index] },
      ];
      for (const line of lines) {
        if (line.amount <= 0) continue;
        book(await this.recordMerchantLine({ turn, ...line, partnerId: cityId, houseId: house.houseId }), `${line.type} of ${house.houseId}`);
      }
    }
    if (duty > 0) {
      book(await this.recordCityLine({
        turn,
        type: `export_${good}`,
        amount: duty,
        description: `Douane export ${good} → ${cityId} (${taken} unités × ${Math.round(dutyRate * 100)}%)`,
        partnerId: cityId,
        dutyRate,
        customsBase: gross,
      }), `export_${good}`);
    }

    // The statistics of the sale (what the city's panel lists), one row per warehouse that held the deals.
    for (const { hub, amount } of byHub) {
      const share = amount / taken;
      await this.recordMerchantSale({
        turn, monthIndex, year, cityId,
        hubId: hub.id, hubX: hub.x, hubY: hub.y, hubType: hub.type,
        good, dealGood: want.merchantGood, quantity: amount, unitPrice, saleRatio,
        grossRevenue: gross * share, netRevenue: (gross - duty) * share, customsCollected: duty * share, customsRate: dutyRate,
      });
    }
    return true;
  }

  /**
   * One offer of the city at an order month. What is waiting (the merchants' deals) and what the warehouses can take
   * decide the quantity; the price (ImportPricePolicy) and the failures of the last orders decide whether our
   * merchants keep dealing (TradeCeasePolicy). The reason a deal is ceased is kept on the relation, with who ceased it,
   * and lifted the first order month the reason no longer holds.
   * @returns {Promise<boolean>} Whether anything was delivered.
   */
  async #runOffer({ relation, entry, hubs, offer, turn, monthIndex, year }) {
    const cityId = relation.cityId;
    const good = offer.good;
    if (!relation.importCeased || !relation.importFailures) {
      throw new Error(`[trade] the relation with ${cityId} holds no importCeased/importFailures: it was not opened by this version`);
    }
    const dealHubs = hubs.filter((hub) => this.hubHolds(hub, offer.merchantGood));
    // No warehouse built that can take the good counts as no room: an offer whose good no warehouse TYPE can hold is
    // a catalog defect, guarded by the catalog's integrity test, not something to find out in a player's game.
    const receiving = hubs.filter((hub) => this.hubHolds(hub, good));
    const waiting = dealHubs.reduce((sum, hub) => sum + (hub.stocks[offer.merchantGood] ?? 0), 0);
    const room = receiving.reduce((sum, hub) => sum + this.hubRoom(hub), 0);

    // Consecutive order months a reason held, so one bad month does not stop the merchants. Without a deal waiting,
    // the reason is the warehouse when none can take the good (none built, or no room left: the deals could not even
    // be filed), the merchants otherwise.
    const before = relation.importFailures[good] ?? {};
    const next = (reason, holds) => (waiting === 0 && holds ? (before[reason] ?? 0) + 1 : 0);
    const failures = {
      no_merchants: next('no_merchants', receiving.length > 0 && room > 0),
      no_warehouse: next('no_warehouse', receiving.length === 0),
      warehouse_full: next('warehouse_full', receiving.length > 0 && room <= 0),
    };
    relation.importFailures = { ...relation.importFailures, [good]: failures };

    // A deal sits in the warehouse and becomes the real good in it: the room it takes is the room the good takes.
    const planned = Math.min(offer.quantityPerOrder, waiting);
    const pricing = priceImportDelivery({
      cityId, offer, quantity: planned > 0 ? planned : offer.quantityPerOrder, dutyRate: await this.getCustomsDuty('anoria', 'import', good, turn),
    });
    const ceases = findCeaseReason('import', { pricing, baseValue: getResourceBaseValue(good), failures });
    const ceasedBefore = relation.importCeased[good] ?? null;
    if (ceases) {
      if (ceasedBefore?.reason !== ceases.reason) relation.importCeased = { ...relation.importCeased, [good]: { ...ceases, turn } };
      return false;
    }
    if (ceasedBefore) {
      const { [good]: _lifted, ...stillCeased } = relation.importCeased;
      relation.importCeased = stillCeased;
    }
    if (planned <= 0) return false;

    return this.#deliver({ relation, offer, hubs, quantity: planned, turn, monthIndex, year });
  }

  /**
   * Consume `quantity` deals, pay and book the delivery on the importers' accounts, and file the goods in the
   * warehouses with room. The deals are taken first: what was really available decides the quantity, so the price is
   * computed again on it. A refused journal line throws (a delivery is never half-booked silently).
   */
  async #deliver({ relation, offer, hubs, quantity, turn, monthIndex, year }) {
    const cityId = relation.cityId;
    const good = offer.good;
    const { taken, lots } = await this.#takeFromHubsForClient(hubs, offer.merchantGood, `city:${cityId}`, quantity, turn);
    if (taken <= 0) return false;
    // The hubs just lost their deals: the room and the stocks to file the goods on are the ones they hold now.
    const receiving = hubs.filter((hub) => this.hubHolds(hub, good));

    const delivery = priceImportDelivery({ cityId, offer, quantity: taken, dutyRate: await this.getCustomsDuty('anoria', 'import', good, turn) });

    // Each merchant house is the importer of the deals it made, in proportion.
    const unitsByHouse = new Map();
    for (const lot of lots) {
      const houseId = this.producerOfLot(lot.key);
      if (!houseId) throw new Error(`[trade] the deal lot "${lot.key}" names no merchant house`);
      unitsByHouse.set(houseId, (unitsByHouse.get(houseId) ?? 0) + lot.amount);
    }
    const houses = [...unitsByHouse.entries()].map(([houseId, units]) => ({ houseId, units }));
    const weights = houses.map((house) => house.units);
    const foreignOf = splitByWeight(delivery.foreign, weights);
    const transportOf = splitByWeight(delivery.transport, weights);
    const dutyOf = splitByWeight(delivery.duty, weights);
    const marginOf = splitByWeight(delivery.margin, weights);
    const dutyRate = await this.getCustomsDuty('anoria', 'import', good, turn);

    const book = async (result, what) => {
      if (!result?.recorded) throw new Error(`[trade] the journal refused ${what}: ${result?.reason ?? 'no reason given'}`);
    };
    for (const [index, house] of houses.entries()) {
      const lines = [
        { type: `import_${good}`, amount: foreignOf[index], description: `Import ${good} ← ${cityId} (${house.units} unités)` },
        { type: `freight_${good}`, amount: transportOf[index], description: `Transport ${good} ← ${cityId} (${house.units} unités)` },
        { type: `duty_paid_import_${good}`, amount: dutyOf[index], description: `Douane import ${good} ← ${cityId} (${house.units} unités)`, dutyRate, customsBase: centimes(foreignOf[index] + transportOf[index]) },
      ];
      for (const line of lines) {
        if (line.amount <= 0) continue;
        await book(await this.recordMerchantLine({ turn, ...line, partnerId: cityId, houseId: house.houseId }), `${line.type} of ${house.houseId}`);
      }
      house.sale = centimes(foreignOf[index] + transportOf[index] + dutyOf[index] + marginOf[index]);
    }
    if (delivery.duty > 0) {
      await book(await this.recordCityLine({
        turn,
        type: `customs_import_${good}`,
        amount: delivery.duty,
        description: `Douane import ${good} ← ${cityId} (${taken} unités × ${Math.round(dutyRate * 100)}%)`,
        partnerId: cityId,
        dutyRate,
        customsBase: delivery.customsValue,
      }), `customs_import_${good}`);
    }

    // The goods go into the warehouses with room, in order; each merchant house's units are sold to the warehouse
    // that receives them (the queue below), at its own price per unit.
    const queue = houses.map((house) => ({ ...house, left: house.units, unitPrice: house.sale / house.units }));
    let remaining = taken;
    for (const hub of receiving) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, this.hubRoom(hub));
      if (amount <= 0) continue;
      const nextStock = this.addHubStock(hub, good, amount);
      await this.supplyRepo.saveStocks(hub.id, nextStock);
      await this.hubServing.deposit({ hubId: hub.id, category: good, producerId: `city:${cityId}`, amount, stockAfter: nextStock[good] });
      // The hub list is read once per pass: the slot now holds what this delivery left, for the next offer.
      hubs[hubs.indexOf(hub)] = { ...hub, stocks: nextStock };

      let toPlace = amount;
      for (const house of queue) {
        if (toPlace <= 0) break;
        const units = Math.min(house.left, toPlace);
        if (units <= 0) continue;
        await this.recordImportDelivery({ turn, monthIndex, year, houseId: house.houseId, hubId: hub.id, good, quantity: units, unitPrice: house.unitPrice });
        house.left -= units;
        toPlace -= units;
      }
      remaining -= amount;
    }
    if (remaining > 0) throw new Error(`[trade] ${remaining} ${good} from ${cityId} fit in no warehouse although the room was counted`);
    return true;
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
   * @returns {Promise<{ taken: number, byHub: Array<{ hub: object, amount: number }>, lots: Array<{ key: string, amount: number }> }>} Units actually taken
   *   (may be less than `qty` if none is available or a higher-ranked client is still owed some), and which
   *   hub(s) they came from — an export sale is credited to the hub(s) that actually held the stock, in the
   *   same proportion, exactly like any other seller in the chain (see RunMonthlyCityTradeCycle's header).
   */
  async #takeFromHubsForClient(hubs, good, client, qty, turn) {
    let remaining = qty;
    const byHub = [];
    const lots = [];
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

      byHub.push({ hub, amount: takenHere });
      lots.push(...takes);
      remaining -= takenHere;
    }
    return { taken: qty - remaining, byHub, lots };
  }
}
