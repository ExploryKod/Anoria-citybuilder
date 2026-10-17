/** Full fiscal years kept in the journal before the current one; older years are purged whole. */
export const JOURNAL_KEPT_FULL_YEARS = 5;

/**
 * Per-turn budget orchestration (taxes, salaries, the producers' charges, enrichments).
 */
export class ProcessTurnBudget {
  /**
   * @param {object} deps
   * @param {(time: number) => Promise<object>} deps.collectCitizenTaxes
   * @param {(time: number) => object} deps.getTimeInfo
   * @param {({ time: number, deliveredTime: number }) => Promise<void>} deps.settleProducerCharges
   * @param {({ time: number, deliveredTime: number }) => Promise<void>} [deps.settleBankDepositInterest] a bank's
   *   monthly interest to its depositors — run right before settleProducerCharges, same day, same month, so the
   *   expense it books already exists in the journal when the bank's own taxable profit is computed
   * @param {() => Promise<unknown>} [deps.revalueMinimumWage] an indexed minimum wage follows the cost of living, once a year (the first month of the year)
   * @param {({ time: number }) => Promise<unknown>} [deps.adjustWageRates] the labour market moves the wages, right after the month's payroll
   * @param {() => Promise<void>|void} [deps.processLoanPayments]
   * @param {(keepYears: number) => Promise<unknown>} deps.cleanupOldJournalYears
   * @param {() => Promise<unknown>} deps.flushJournalSessionToDexie
   */
  constructor(deps) {
    this.deps = deps;
  }

  #processBudgetInFlight = false;

  reset() {
    this.#processBudgetInFlight = false;
  }

  /**
   * @param {object} params
   * @param {number} params.time
   * @param {number} params.totalPop
   * @returns {Promise<object>}
   */
  async execute({ time }) {
    if (this.#processBudgetInFlight) {
      return {};
    }

    this.#processBudgetInFlight = true;
    const result = {};

    try {
      const taxCollection = await this.deps.collectCitizenTaxes(time);
      // November without a tax collector: the caller says so to the player (see runGameTurnEconomy.js).
      if (taxCollection?.citizenTaxUncollectedYear != null) result.citizenTaxUncollectedYear = taxCollection.citizenTaxUncollectedYear;

      const timeInfo = this.deps.getTimeInfo(time);
      if (!timeInfo.month) throw new Error(`[ProcessTurnBudget] the calendar gave no month name for turn ${time}`);
      const isFirstTurnOfMonth = timeInfo.dayInMonth === 1;

      if (isFirstTurnOfMonth && time > 0) {
        // The bank's own interest expense must exist in the journal before settleProducerCharges reads it (its
        // otherExpensesHT) to compute the bank's taxable profit for the same month — see SettleBankDepositInterest.js.
        if (this.deps.settleBankDepositInterest) {
          await this.deps.settleBankDepositInterest({ time, deliveredTime: time - 1 });
        }
        await this.deps.settleProducerCharges({ time, deliveredTime: time - 1 });
        // The rents come last of the month's charges: a house pays what is left of its month, and what it cannot pay stays a debt.
        if (this.deps.settleHouseRents) {
          await this.deps.settleHouseRents({ time, deliveredTime: time - 1 });
        }
        // Every January an indexed minimum wage is revalued on the cost of living, before the market moves the wages above it.
        if (this.deps.revalueMinimumWage && timeInfo.monthIndex === 0) await this.deps.revalueMinimumWage();
        // The month was paid at the wages in force: only now does the labour market move them for the month that opens.
        if (this.deps.adjustWageRates) await this.deps.adjustWageRates({ time });
        // The month's accounts are closed: the caller may judge what they show (the departures, see runGameTurnEconomy.js).
        result.monthSettled = true;
      }

      if (this.deps.processLoanPayments) {
        await this.deps.processLoanPayments();
      }

      if (time % 3 === 0 && time > 0) {
        try {
          await this.deps.cleanupOldJournalYears(JOURNAL_KEPT_FULL_YEARS);
        } catch (error) {
          throw new Error(`[ProcessTurnBudget] failed to save the turn ${time} budget state: ${error.message}`, { cause: error });
        }
      }

      await this.deps.flushJournalSessionToDexie();
    } catch (error) {
      throw new Error(`[ProcessTurnBudget] budget operations failed at turn ${time}: ${error.message}`, { cause: error });
    } finally {
      this.#processBudgetInFlight = false;
    }

    return result;
  }
}
