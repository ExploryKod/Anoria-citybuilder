import db from '../../../../core/persistence/dexie/db.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getGoodCategories, getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

/**
 * Dexie adapter — resource supply chain audit log (`supplyTraceability` table).
 */
export class DexieSupplyTraceabilityRepository {
  constructor(database = db) {
    this.db = database;
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
    try {
      await this.db.supplyTraceability.add({
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
    } catch (error) {
      console.error('[DexieSupplyTraceabilityRepository] Error adding transaction:', error);
    }
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
    const count = await this.db.supplyTraceability
      .where('transactionType')
      .equals('service_cutoff')
      .filter((row) => row.hamletId === hamletId && row.year === year && row.month === monthIndex && row.toId === houseId && row.foodType === service)
      .count();
    return count > 0;
  }

  async recordEconomyMovement({ turn, monthIndex, year, kind, amount, buildingId, counterpartyId, businessKey }) {
    const hamletId = requireActiveHamletId();
    const existing = await this.db.supplyTraceability
      .where('transactionType')
      .equals(kind)
      .filter((row) => row.hamletId === hamletId && row.businessKey === businessKey)
      .first();
    if (existing) return;
    await this.db.supplyTraceability.add({
      hamletId,
      turn,
      month: monthIndex,
      year,
      transactionType: kind,
      fromId: buildingId,
      fromCoords: null,
      fromType: null,
      toId: counterpartyId,
      toCoords: null,
      toType: null,
      foodType: null,
      quantity: 1,
      price: amount,
      totalPrice: amount,
      businessKey,
    });
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
    const hamletId = requireActiveHamletId();
    const services = getServiceCategories();
    const rows = await this.db.supplyTraceability
      .where('transactionType')
      .equals('distributor_to_consumer')
      .filter((row) => row.hamletId === hamletId && row.year === year && row.month === monthIndex && services.includes(row.foodType))
      .toArray();
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
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<Array<{ sellerId: string, buyerId: string | null, amountHT: number }>>}
   */
  async sumGoodsFlowsByPair(year, monthIndex) {
    const hamletId = requireActiveHamletId();
    const goods = getGoodCategories();
    // The goods a distributor sells to the houses are not here: each delivery is paid when it is made (RecordConsumerPurchases).
    const rows = await this.db.supplyTraceability
      .where('transactionType')
      .anyOf(['source_to_hub', 'source_to_distributor'])
      .filter((row) => row.hamletId === hamletId && row.year === year && row.month === monthIndex && goods.includes(row.foodType))
      .toArray();
    const pairs = new Map();
    for (const row of rows) {
      if (!row.fromId) throw new Error(`[traceability] goods transfer ${row.id} names no seller`);
      if (!row.toId) throw new Error(`[traceability] goods transfer ${row.id} names no buyer`);
      const buyerId = row.toId;
      const key = `${row.fromId}>${buyerId}`;
      const pair = pairs.get(key) ?? { sellerId: row.fromId, buyerId, amountHT: 0 };
      pair.amountHT += row.quantity * row.price;
      pairs.set(key, pair);
    }
    return [...pairs.values()].map((pair) => ({ ...pair, amountHT: Math.round(pair.amountHT * 100) / 100 }));
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
   * State of one building of the harvest chain (a farm or a hub) on a monthly
   * tick: `quantity` is 1 when it can work (road + staff), 0 when it is idle.
   */
  async recordChainState(turn, month, year, building, foodType, quantity) {
    await this.addTransaction(turn, month, year, 'chain_state', building, null, foodType, quantity, 0);
  }

  /**
   * Full state of one building (stocks, staff, level…) at the moment it changed:
   * the log keeps a row only when something differs from the last one, so a state
   * lasts until the next row.
   */
  async recordBuildingState(turn, month, year, building, state) {
    await this.addTransaction(turn, month, year, 'building_state', building, null, null, 0, 0, { state });
  }

  /**
   * The city's employment at a month's end (jobs, unemployed, by social group): the log keeps
   * a row only when it differs from the last one.
   */
  async recordEmploymentSummary(turn, month, year, summary) {
    await this.addTransaction(turn, month, year, 'employment_summary', null, null, null, 0, 0, { summary });
  }

  /**
   * Something that happened to the city (a house went up a level, people died of
   * famine, a building was placed or demolished): `event` says what, `subject` is
   * the building concerned (or null), `details` the numbers that explain it.
   */
  async recordGameEvent(turn, month, year, event, subject, quantity, details = {}) {
    await this.addTransaction(turn, month, year, 'game_event', subject, null, null, quantity, 0, { event, details });
  }

  /** Inhabitants of one house on a monthly tick, so past months show the population they really had. */
  async recordPopulationState(turn, month, year, house, foodType, population) {
    await this.addTransaction(turn, month, year, 'population_state', house, null, foodType, population, 0);
  }

  /**
   * A producer whose harvest no hub bought on a collection turn, and why
   * (`cause`: no_road, no_workers, hub_full, hub_idle, unknown).
   */
  async recordSaleMissed(turn, month, year, source, foodType, cause) {
    await this.addTransaction(turn, month, year, 'sale_missed', source, null, foodType, 0, 0, { cause });
  }

  /** A producer's harvest bought by a hub on that turn — the only proof it really delivered. */
  async recordSourceToHub(turn, month, year, source, hub, foodType, quantity, price) {
    await this.addTransaction(turn, month, year, 'source_to_hub', source, hub, foodType, quantity, price);
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
    const all = await this.db.supplyTraceability
      .filter((t) => t.transactionType === 'merchant_sale' && t.cityId === cityId)
      .toArray();
    return all.sort((a, b) => b.turn - a.turn || b.month - a.month);
  }
}
