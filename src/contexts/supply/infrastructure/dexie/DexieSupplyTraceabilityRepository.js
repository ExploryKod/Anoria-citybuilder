import db from '../../../../core/persistence/dexie/db.js';

/**
 * Dexie adapter — food supply chain audit log (`foodTraceability` table).
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
   * @param {number} [price=1]
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
    price = 1,
    extra = {}
  ) {
    try {
      await this.db.foodTraceability.add({
        turn,
        month,
        year,
        date: new Date().toISOString(),
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

  async recordSourceToDistributor(turn, month, year, source, distributor, foodType, quantity, price = 1) {
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
  async recordSourceToHub(turn, month, year, source, hub, foodType, quantity) {
    await this.addTransaction(turn, month, year, 'source_to_hub', source, hub, foodType, quantity, 0);
  }

  async recordDistributorToConsumer(turn, month, year, distributor, consumer, foodType, quantity, price = 1) {
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

  async recordHouseConsumption(turn, month, year, house, foodType, quantity, _citizens) {
    await this.addTransaction(
      turn,
      month,
      year,
      'house_consumption',
      house,
      null,
      foodType,
      quantity,
      0
    );
  }

  /** @param {number} turn @param {number|null} [month=null] */
  async getTransactionsForMonth(turn, month = null) {
    let query = this.db.foodTraceability.where('turn').equals(turn);

    if (month !== null) {
      query = query.and((transaction) => transaction.month === month);
    }

    return query.sortBy('date');
  }

  /** @param {number|null} [maxAge=null] age in days */
  async getAllTransactions(maxAge = null) {
    let transactions = await this.db.foodTraceability.toArray();

    if (maxAge) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      transactions = transactions.filter(
        (transaction) => new Date(transaction.date) >= cutoffDate
      );
    }

    return transactions.sort((a, b) => {
      if (a.turn !== b.turn) {
        return b.turn - a.turn;
      }
      if (a.month !== b.month) {
        return a.month - b.month;
      }
      return new Date(a.date) - new Date(b.date);
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

  async cleanupOldTransactions(maxAge = 60) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      const oldTransactions = await this.db.foodTraceability
        .where('date')
        .below(cutoffDate.toISOString())
        .toArray();

      if (oldTransactions.length > 0) {
        const ids = oldTransactions.map((t) => t.id);
        await this.db.foodTraceability.bulkDelete(ids);
      }
    } catch (error) {
      console.error('[DexieSupplyTraceabilityRepository] Error cleaning up:', error);
    }
  }
}
