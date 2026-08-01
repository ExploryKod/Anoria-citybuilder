/**
 * Orchestrator — informative journal lines at turn boundaries (balance, cumul, carry forward).
 */
export class SyncTurnInformativeEntries {
  /**
   * @param {import('./RecordBalanceSnapshot.js').RecordBalanceSnapshot} recordBalanceSnapshot
   * @param {import('./RecordYearCumulEntries.js').RecordYearCumulEntries} recordYearCumulEntries
   * @param {import('./RecordCarryForwardEntry.js').RecordCarryForwardEntry} recordCarryForwardEntry
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(
    recordBalanceSnapshot,
    recordYearCumulEntries,
    recordCarryForwardEntry,
    gameTimePort
  ) {
    this.recordBalanceSnapshot = recordBalanceSnapshot;
    this.recordYearCumulEntries = recordYearCumulEntries;
    this.recordCarryForwardEntry = recordCarryForwardEntry;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {number} params.previousTurn
   * @param {number} params.treasuryFunds
   */
  async execute({ turn, previousTurn, treasuryFunds }) {
    await this.recordBalanceSnapshot.execute({ turn, amount: treasuryFunds });

    const currentTime = this.gameTimePort.getTimeInfo(turn);
    const previousTime = this.gameTimePort.getTimeInfo(previousTurn);

    if (!currentTime || !previousTime) {
      return { balanceRecorded: true, cumulRecorded: 0, carryForwardRecorded: false };
    }

    let cumulRecorded = 0;
    let carryForwardRecorded = false;

    if (
      previousTime.year >= 0 &&
      previousTime.monthIndex === 11 &&
      currentTime.year > previousTime.year
    ) {
      const cumulResult = await this.recordYearCumulEntries.execute({
        year: previousTime.year,
        turn: previousTurn,
      });
      cumulRecorded = cumulResult.recorded ?? 0;
    }

    if (
      currentTime.year > 0 &&
      currentTime.monthIndex === 0 &&
      previousTime.year < currentTime.year
    ) {
      const carryResult = await this.recordCarryForwardEntry.execute({ turn });
      carryForwardRecorded = carryResult.recorded === true;
    }

    return { balanceRecorded: true, cumulRecorded, carryForwardRecorded };
  }
}
