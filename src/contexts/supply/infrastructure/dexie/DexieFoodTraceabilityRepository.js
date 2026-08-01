import db from '../../../../core/persistence/dexie/db.js';

/**
 * Dexie adapter — food supply chain audit log (`foodTraceability` table).
 */
export class DexieFoodTraceabilityRepository {
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
    price = 1
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
      });
    } catch (error) {
      console.error('[DexieFoodTraceabilityRepository] Error adding transaction:', error);
    }
  }

  async recordFarmToMarket(turn, month, year, farm, market, foodType, quantity, price = 1) {
    await this.addTransaction(
      turn,
      month,
      year,
      'farm_to_market',
      farm,
      market,
      foodType,
      quantity,
      price
    );
  }

  async recordMarketToHouse(turn, month, year, market, house, foodType, quantity, price = 1) {
    await this.addTransaction(
      turn,
      month,
      year,
      'market_to_house',
      market,
      house,
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
      console.error('[DexieFoodTraceabilityRepository] Error cleaning up:', error);
    }
  }
}
