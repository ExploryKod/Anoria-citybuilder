import db from '../../../../core/persistence/dexie/db.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getGoodCategories, getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/** The transfers by which a building sells its goods on. */
const SOLD_ON_TYPES = Object.freeze(['source_to_hub', 'source_to_distributor', 'hub_to_building', 'distributor_to_consumer']);

/**
 * Dexie adapter — resource supply chain audit log (`supplyTraceability` table).
 */
export class DexieSupplyTraceabilityRepository {
  /** The rows waiting for the end of the unit of work in progress (see `inUnitOfWork`), or null when there is none. */
  #buffer = null;

  constructor(database = db) {
    this.db = database;
  }

  /**
   * Runs `work` with the rows it adds written together, in one `bulkAdd` when it ends (even if it threw), in the order they were added. A cycle adds dozens of
   * rows a day, each of them a transaction. A read made meanwhile writes what is waiting first, so it sees what the cycle has added.
   * @template T
   * @param {() => Promise<T>} work
   * @returns {Promise<T>}
   */
  async inUnitOfWork(work) {
    if (this.#buffer) return work();
    this.#buffer = [];
    try {
      return await work();
    } finally {
      try {
        await this.#flush();
      } finally {
        this.#buffer = null;
      }
    }
  }

  async #flush() {
    if (!this.#buffer || this.#buffer.length === 0) return;
    const rows = this.#buffer;
    this.#buffer = [];
    await this.db.supplyTraceability.bulkAdd(rows);
  }

  /** Adds a row now, or at the end of the unit of work in progress. */
  async #add(row) {
    if (this.#buffer) {
      this.#buffer.push(row);
      return;
    }
    await this.db.supplyTraceability.add(row);
  }

  /**
   * @param {number} turn
   * @param {number} month
   * @param {number} year
   * @param {string} transactionType
   * @param {object|null} from
   * @param {object|null} to
   * @param {string} foodType
   * @param {number} quantity
   * @param {number} price value of one unit (the catalog's baseValue for an exchange, 0 for a non-exchange row)
   * @param {Record<string, unknown>} [extra] Extra fields stored on the row (e.g. a `cause`).
   */
  async addTransaction(
    turn,
    month,
    year,
    transactionType,
    from,
    to,
    foodType,
    quantity,
    price,
    extra = {}
  ) {
    // A failed write throws: a missing row in the audit log is a defect to see, not a line to skip.
    await this.#add({
      hamletId: requireActiveHamletId(),
      turn,
      month,
      year,
      transactionType,
      fromId: from?.id || null,
      fromCoords: from ? `${from.x},${from.y}` : null,
      fromType: from?.type || null,
      toId: to?.id || null,
      toCoords: to ? `${to.x},${to.y}` : null,
      toType: to?.type || null,
      foodType,
      quantity,
      price,
      totalPrice: quantity * price,
      ...extra,
    });
  }

  /**
   * One private money movement of the economy (a company's wage, upkeep, subsidy or corporate tax), written once: a row
   * with the same business key is already in the register, so it is not written again. Throws on a failed write: a missing
   * movement in the register is a defect, not a skipped line.
   * The building the movement concerns is the holder (`fromId`); the counterparty, when there is one, is `toId`.
   * @param {{ turn: number, monthIndex: number, year: number, kind: string, amount: number, buildingId: string, counterpartyId: string | null, businessKey: string }} movement
   */
  /**
   * A house's bill for a service was not paid: the house is cut off from that service for the month. Only the fact is kept
   * here; the money is in the journal.
   * @param {{ turn: number, year: number, monthIndex: number, houseId: string, service: string }} cutOff
   */
  async recordServiceCutOff({ turn, year, monthIndex, houseId, service }) {
    await this.addTransaction(turn, monthIndex, year, 'service_cutoff', null, { id: houseId, x: null, y: null, type: null }, service, 1, 0);
  }

  /**
   * @param {{ year: number, monthIndex: number, houseId: string, service: string }} params
   * @returns {Promise<boolean>} whether the house is cut off from the service that month
   */
  async hasServiceCutOff({ year, monthIndex, houseId, service }) {
    const hamletId = requireActiveHamletId();
    await this.#flush();
    const count = await this.db.supplyTraceability
      .where('transactionType')
      .equals('service_cutoff')
      .filter((row) => row.hamletId === hamletId && row.year === year && row.month === monthIndex && row.toId === houseId && row.foodType === service)
      .count();
    return count > 0;
  }

  /**
   * The rows of the active hamlet for one month, of the given transaction types. They are read through the month's index: only that month's rows are touched, never the
   * whole table, so a month's settlement does not slow down as the game grows old.
   * @param {number} year
   * @param {number} monthIndex
   * @param {ReadonlyArray<string>} types
   * @returns {Promise<Array<object>>}
   */
  async #rowsOfMonth(year, monthIndex, types) {
    const hamletId = requireActiveHamletId();
    await this.#flush();
    return this.db.supplyTraceability
      .where('[hamletId+year+month]')
      .equals([hamletId, year, monthIndex])
      .filter((row) => types.includes(row.transactionType))
      .toArray();
  }

  /**
   * The services each company sold to each house in one month: a service rides the distributor→consumer chain, so each
   * delivery is one row, from the company that distributes it to the house that receives it. Grouped per (company, house,
   * service); only the pairs that were delivered are in the result.
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<Array<{ buildingId: string, houseId: string, service: string, units: number }>>}
   */
  async sumServiceFlows(year, monthIndex) {
    const services = getServiceCategories();
    const rows = (await this.#rowsOfMonth(year, monthIndex, ['distributor_to_consumer'])).filter((row) => services.includes(row.foodType));
    const byFlow = new Map();
    for (const row of rows) {
      if (!row.fromId) throw new Error(`[traceability] service delivery ${row.id} names no company`);
      if (!row.toId) throw new Error(`[traceability] service delivery ${row.id} names no house`);
      const key = `${row.fromId}>${row.toId}>${row.foodType}`;
      const flow = byFlow.get(key) ?? { buildingId: row.fromId, houseId: row.toId, service: row.foodType, units: 0 };
      flow.units += row.quantity;
      byFlow.set(key, flow);
    }
    return [...byFlow.values()];
  }

  /**
   * The goods flows of one month, pair by pair, at the catalog's price (HT): each seller's sales to a buyer of the chain
   * (`buyerId`), or to the houses (`buyerId` null). Services are not goods: they are not in it.
   *
   * An export sale (`merchant_sale`) is not in it: our merchants are the exporters, so the sale is theirs (their lines are
   * written when the city's order is delivered, see RunMonthlyCityTradeCycle), and what they bought from the warehouse
   * to make the deals is a `hub_to_building` purchase, in it like any other.
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<Array<{ sellerId: string, buyerId: string | null, amountHT: number }>>}
   */
  async sumGoodsFlowsByPair(year, monthIndex) {
    const goods = getGoodCategories();
    // The goods a distributor sells to the houses are not here: each delivery is paid when it is made (RecordConsumerPurchases).
    const rows = (await this.#rowsOfMonth(year, monthIndex, ['source_to_hub', 'source_to_distributor', 'hub_to_building'])).filter((row) => goods.includes(row.foodType));
    const pairs = new Map();
    for (const row of rows) {
      if (!row.fromId) throw new Error(`[traceability] goods transfer ${row.id} names no seller`);
      if (!row.toId) throw new Error(`[traceability] goods transfer ${row.id} names no buyer`);
      const key = `${row.fromId}>${row.toId}`;
      const pair = pairs.get(key) ?? { sellerId: row.fromId, buyerId: row.toId, amountHT: 0 };
      pair.amountHT += row.quantity * row.price;
      pairs.set(key, pair);
    }
    return [...pairs.values()].map((pair) => ({ ...pair, amountHT: Math.round(pair.amountHT * 100) / 100 }));
  }

  /**
   * What the warehouses and the markets of the active hamlet received over a range of months, per receiver and good: the quantity and what
   * it cost (the sellers' prices at the time). It is what a stock's average cost is read from (see PriceBook).
   * @param {{ fromKey: number, toKey: number }} range months as `year × 12 + monthIndex`, both ends included
   * @returns {Promise<Array<{ buyerId: string, category: string, stage: 'hub' | 'distributor', quantity: number, amount: number }>>}
   */
  async sumInflowCosts({ fromKey, toKey }) {
    const hamletId = requireActiveHamletId();
    const goods = getGoodCategories();
    await this.#flush();
    const rows = await this.db.supplyTraceability
      .where('transactionType')
      .anyOf(['source_to_hub', 'source_to_distributor'])
      .filter((row) => {
        const key = row.year * MONTHS_PER_YEAR + row.month;
        return row.hamletId === hamletId && key >= fromKey && key <= toKey && goods.includes(row.foodType);
      })
      .toArray();
    const sums = new Map();
    for (const row of rows) {
      if (!row.toId) throw new Error(`[traceability] goods transfer ${row.id} names no buyer`);
      const key = `${row.toId}|${row.foodType}`;
      const sum = sums.get(key) ?? {
        buyerId: row.toId,
        category: row.foodType,
        stage: row.transactionType === 'source_to_hub' ? 'hub' : 'distributor',
        quantity: 0,
        amount: 0,
      };
      sum.quantity += row.quantity;
      sum.amount += row.quantity * row.price;
      sums.set(key, sum);
    }
    return [...sums.values()];
  }

  /**
   * What one company bought from its suppliers and sold to its buyers (another stage, or the houses) in a month, in euros, at the prices the
   * deliveries were traced at: the purchases are what the month's settlement has not yet paid when the month is the current one.
   * @param {string} buildingId
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<{ bought: number, sold: number }>}
   */
  async sumTradeOf(buildingId, year, monthIndex) {
    const goods = getGoodCategories();
    const rows = (await this.#rowsOfMonth(year, monthIndex, ['source_to_hub', 'source_to_distributor', 'hub_to_building', 'distributor_to_consumer'])).filter((row) => goods.includes(row.foodType));
    let bought = 0;
    let sold = 0;
    for (const row of rows) {
      if (row.transactionType !== 'distributor_to_consumer' && row.toId === buildingId) bought += row.quantity * row.price;
      if (row.transactionType !== 'source_to_hub' && row.fromId === buildingId) sold += row.quantity * row.price;
    }
    return { bought: Math.round(bought * 100) / 100, sold: Math.round(sold * 100) / 100 };
  }

  /**
   * The units each building sold in a month, goods and services alike: what a producer or a hub sold to another stage (source_to_hub,
   * source_to_distributor, hub_to_building), what a market delivered to the houses (distributor_to_consumer). It is the quantity a unit cost
   * (the month's charges over the units sold) is read against.
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<Map<string, number>>} seller id → units
   */
  async sumUnitsSoldBySeller(year, monthIndex) {
    const rows = await this.#rowsOfMonth(year, monthIndex, ['source_to_hub', 'source_to_distributor', 'hub_to_building', 'distributor_to_consumer']);
    const units = new Map();
    for (const row of rows) {
      if (!row.fromId) throw new Error(`[traceability] transfer ${row.id} names no seller`);
      units.set(row.fromId, (units.get(row.fromId) ?? 0) + row.quantity);
    }
    return units;
  }

  /**
   * What one building lost to spoilage (`goods_spoiled` events), per good: in a month, or in the whole year when `monthIndex` is null.
   * @param {number} buildingId
   * @param {number} year
   * @param {number | null} monthIndex
   * @returns {Promise<Record<string, number>>} good → units lost
   */
  async sumSpoilageOf(buildingId, year, monthIndex = null) {
    const hamletId = requireActiveHamletId();
    await this.#flush();
    const rows = await this.db.supplyTraceability
      .where('transactionType')
      .equals('game_event')
      .filter((row) => row.event === 'goods_spoiled' && row.hamletId === hamletId && row.fromId === buildingId && row.year === year && (monthIndex === null || row.month === monthIndex))
      .toArray();
    const lost = {};
    for (const row of rows) {
      if (!row.details?.good) throw new Error(`[traceability] spoilage ${row.id} names no good`);
      lost[row.details.good] = (lost[row.details.good] ?? 0) + row.quantity;
    }
    return lost;
  }

  /**
   * What one building handled over a range of months, per good and per month: the units it sold on (to a hub, a market, a house) and the units it
   * lost to spoilage. Together they are what went through its stock, the total a loss is set against.
   * @param {string} buildingId
   * @param {{ fromKey: number, toKey: number }} range months as `year × 12 + monthIndex`, both ends included
   * @returns {Promise<Record<string, Record<number, { sold: number, spoiled: number }>>>} good → month key → units
   */
  async sumShelfFlowsOf(buildingId, { fromKey, toKey }) {
    const hamletId = requireActiveHamletId();
    await this.#flush();
    const rows = await this.db.supplyTraceability
      .where('transactionType')
      .anyOf([...SOLD_ON_TYPES, 'game_event'])
      .filter((row) => {
        if (row.hamletId !== hamletId || row.fromId !== buildingId) return false;
        const key = row.year * MONTHS_PER_YEAR + row.month;
        return key >= fromKey && key <= toKey && (row.event === 'goods_spoiled' || SOLD_ON_TYPES.includes(row.transactionType));
      })
      .toArray();
    const flows = {};
    for (const row of rows) {
      const spoiled = row.event === 'goods_spoiled';
      const good = spoiled ? row.details?.good : row.foodType;
      if (!good) throw new Error(`[traceability] row ${row.id} names no good`);
      const key = row.year * MONTHS_PER_YEAR + row.month;
      flows[good] ??= {};
      flows[good][key] ??= { sold: 0, spoiled: 0 };
      flows[good][key][spoiled ? 'spoiled' : 'sold'] += row.quantity;
    }
    return flows;
  }

  /**
   * What every building lost to spoilage in one month (`goods_spoiled` events), per good.
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<Map<string, Record<string, number>>>} building id → good → units lost
   */
  async sumSpoilageByBuilding(year, monthIndex) {
    const rows = (await this.#rowsOfMonth(year, monthIndex, ['game_event'])).filter((row) => row.event === 'goods_spoiled');
    const lost = new Map();
    for (const row of rows) {
      if (!row.details?.good) throw new Error(`[traceability] spoilage ${row.id} names no good`);
      const goods = lost.get(row.fromId) ?? {};
      goods[row.details.good] = (goods[row.details.good] ?? 0) + row.quantity;
      lost.set(row.fromId, goods);
    }
    return lost;
  }

  /**
   * What went through the chain of the goods over a range of months, per good: the units the producers sold on (to a hub or a market), the units sold to the houses, and the units lost to
   * spoilage anywhere. A month's key is `year × MONTHS_PER_YEAR + monthIndex`.
   * @param {{ fromKey: number, toKey: number }} range
   * @returns {Promise<{ collected: Record<string, number>, sold: Record<string, number>, spoiled: Record<string, number> }>}
   */
  async sumChainFlows({ fromKey, toKey }) {
    const flows = { collected: {}, sold: {}, spoiled: {} };
    const add = (into, good, units) => {
      into[good] = (into[good] ?? 0) + units;
    };
    for (let key = fromKey; key <= toKey; key += 1) {
      const rows = await this.#rowsOfMonth(Math.floor(key / MONTHS_PER_YEAR), key % MONTHS_PER_YEAR, [...SOLD_ON_TYPES, 'game_event']);
      for (const row of rows) {
        if (row.transactionType === 'source_to_hub' || row.transactionType === 'source_to_distributor') add(flows.collected, row.foodType, row.quantity);
        else if (row.transactionType === 'distributor_to_consumer') add(flows.sold, row.foodType, row.quantity);
        else if (row.transactionType === 'game_event' && row.event === 'goods_spoiled') {
          if (!row.details?.good) throw new Error(`[traceability] spoilage ${row.id} names no good`);
          add(flows.spoiled, row.details.good, row.quantity);
        }
      }
    }
    return flows;
  }

  /**
   * A month whose settlement has read its transfers keeps one row per (transfer type, seller, buyer, good): the quantities and the amounts added up, the day of the last
   * one. Every reader of the transfers sums them by month, so none can tell; the table stops growing with every delivery of every day. A row that is alone in its group is left as it is.
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<{ merged: number, removed: number }>} the rows written and the rows they replace
   */
  async compactFlowsOfMonth(year, monthIndex) {
    const rows = await this.#rowsOfMonth(year, monthIndex, SOLD_ON_TYPES);
    const groups = new Map();
    for (const row of rows) {
      const key = `${row.transactionType}|${row.fromId}|${row.toId}|${row.foodType}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const merged = [];
    const staleIds = [];
    for (const group of groups.values()) {
      if (group.length === 1) continue;
      const { id: _id, ...first } = group[0];
      const quantity = group.reduce((sum, row) => sum + row.quantity, 0);
      const totalPrice = group.reduce((sum, row) => sum + row.totalPrice, 0);
      merged.push({ ...first, turn: Math.max(...group.map((row) => row.turn)), quantity, totalPrice, price: quantity > 0 ? totalPrice / quantity : first.price });
      staleIds.push(...group.map((row) => row.id));
    }
    if (merged.length === 0) return { merged: 0, removed: 0 };
    await this.db.transaction('rw', this.db.supplyTraceability, async () => {
      await this.db.supplyTraceability.bulkDelete(staleIds);
      await this.db.supplyTraceability.bulkAdd(merged);
    });
    return { merged: merged.length, removed: staleIds.length };
  }

  async recordSourceToDistributor(turn, month, year, source, distributor, foodType, quantity, price) {
    await this.addTransaction(
      turn,
      month,
      year,
      'source_to_distributor',
      source,
      distributor,
      foodType,
      quantity,
      price
    );
  }

  /**
   * Something that happened to the city (a house went up a level, people died of
   * famine, a building was placed or demolished): `event` says what, `subject` is
   * the building concerned (or null), `details` the numbers that explain it.
   */
  async recordGameEvent(turn, month, year, event, subject, quantity, details = {}) {
    await this.addTransaction(turn, month, year, 'game_event', subject, null, null, quantity, 0, { event, details });
  }

  /** Whether a building of the harvest chain (a farm, a hub) can work on a monthly tick: 1 or 0. */
  async recordChainState(turn, month, year, building, foodType, quantity) {
    await this.addTransaction(turn, month, year, 'chain_state', building, null, foodType, quantity, 0);
  }

  /** Inhabitants of one house on a monthly tick, so past months show the population they really had. */
  async recordPopulationState(turn, month, year, house, foodType, population) {
    await this.addTransaction(turn, month, year, 'population_state', house, null, foodType, population, 0);
  }

  /**
   * A producer whose harvest no hub bought on a collection turn, and why
   * (`cause`: no_road, no_workers, hub_full, hub_idle, hub_no_money, unknown).
   */
  async recordSaleMissed(turn, month, year, source, foodType, cause) {
    await this.addTransaction(turn, month, year, 'sale_missed', source, null, foodType, 0, 0, { cause });
  }

  /** A producer's harvest bought by a hub on that turn — the only proof it really delivered. */
  async recordSourceToHub(turn, month, year, source, hub, foodType, quantity, price) {
    await this.addTransaction(turn, month, year, 'source_to_hub', source, hub, foodType, quantity, price);
  }

  /** What a building drew from a hub for a recipe, bought at the hub's price (the hub's sale, the building's purchase). */
  async recordHubToBuilding(turn, month, year, hub, building, foodType, quantity, price) {
    await this.addTransaction(turn, month, year, 'hub_to_building', hub, building, foodType, quantity, price);
  }

  async recordDistributorToConsumer(turn, month, year, distributor, consumer, foodType, quantity, price) {
    await this.addTransaction(
      turn,
      month,
      year,
      'distributor_to_consumer',
      distributor,
      consumer,
      foodType,
      quantity,
      price
    );
  }

  async recordHouseConsumption(turn, month, year, house, foodType, quantity, citizens) {
    await this.addTransaction(
      turn,
      month,
      year,
      'house_consumption',
      house,
      null,
      foodType,
      quantity,
      0,
      // Inhabitants who sat at the table: the ones born afterwards did not
      { pop: Number.isFinite(citizens) ? citizens : null }
    );
  }

  /** @param {number} turn @param {number|null} [month=null] */
  async getTransactionsForMonth(turn, month = null) {
    await this.#flush();
    let query = this.db.supplyTraceability.where('turn').equals(turn);

    if (month !== null) {
      query = query.and((transaction) => transaction.month === month);
    }

    return query.sortBy('id');
  }

  /**
   * @param {string|null} [hamletId=null] only transactions of this hamlet; null = every hamlet
   */
  async getAllTransactions(hamletId = null) {
    await this.#flush();
    let transactions = await this.db.supplyTraceability.toArray();
    if (hamletId) {
      transactions = transactions.filter((transaction) => transaction.hamletId === hamletId);
    }

    // Dated by the turn; the insertion order (id) breaks the ties within a month.
    return transactions.sort((a, b) => {
      if (a.turn !== b.turn) {
        return b.turn - a.turn;
      }
      if (a.month !== b.month) {
        return a.month - b.month;
      }
      return a.id - b.id;
    });
  }

  async getTransactionsByMonth(turn) {
    const transactions = await this.getTransactionsForMonth(turn);
    const byMonth = {};

    transactions.forEach((transaction) => {
      const month = transaction.month;
      if (!byMonth[month]) {
        byMonth[month] = [];
      }
      byMonth[month].push(transaction);
    });

    return byMonth;
  }

  /**
   * All merchant_sale rows for a given city partner, newest first.
   * @param {string} cityId
   */
  async getMerchantSalesForCity(cityId) {
    // addTransaction spreads `extra` onto the record itself (line ~52 above) — there is no nested
    // `.extra` object to read back; the recorded fields (cityId, good, grossRevenue, ...) are
    // top-level, same as turn/month/year/quantity/price.
    await this.#flush();
    const all = await this.db.supplyTraceability
      .filter((t) => t.transactionType === 'merchant_sale' && t.cityId === cityId)
      .toArray();
    return all.sort((a, b) => b.turn - a.turn || b.month - a.month);
  }
}
