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
      await this.deps.collectCitizenTaxes(time);

      const timeInfo = this.deps.getTimeInfo(time);
      if (!timeInfo.month) throw new Error(`[ProcessTurnBudget] the calendar gave no month name for turn ${time}`);
      const isFirstTurnOfMonth = timeInfo.dayInMonth === 1;

      if (isFirstTurnOfMonth && time > 0) {
        await this.deps.settleProducerCharges({ time, deliveredTime: time - 1 });
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
