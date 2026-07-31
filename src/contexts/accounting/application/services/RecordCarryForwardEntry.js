import { buildCarryForwardBusinessKey } from '../../../../js/stores/ledgerBusinessKeys.js';

/**
 * Application service — year-opening carry forward (informative, journal only).
 */
export class RecordCarryForwardEntry {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../ports/YearEndBalancePort.js').YearEndBalancePort} yearEndBalancePort
   */
  constructor(recordLedgerEntry, gameTimePort, journalRepository, yearEndBalancePort) {
    this.recordLedgerEntry = recordLedgerEntry;
    this.gameTimePort = gameTimePort;
    this.journalRepository = journalRepository;
    this.yearEndBalancePort = yearEndBalancePort;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   */
  async execute({ turn }) {
    const timeInfo = this.gameTimePort.getTimeInfo(turn);
    if (!timeInfo || timeInfo.year <= 0) {
      return { recorded: false, skipped: true, reason: 'no_carry_forward_year' };
    }

    const previousYear = timeInfo.year - 1;
    const businessKey = buildCarryForwardBusinessKey(timeInfo.year);
    const yearDisplay = previousYear === 0 ? '0 JC' : `${previousYear} ap JC`;

    let amount;
    let signIndicator;

    const stored = await this.yearEndBalancePort.getYearEndBalance(previousYear);
    if (stored && typeof stored.amount === 'number' && !Number.isNaN(stored.amount)) {
      amount = Math.abs(stored.amount);
      signIndicator = stored.nature === 'revenue' ? '+' : '-';
    } else {
      const yearlyData = await this.journalRepository.getYearlyFinancialSummary();
      const yearData = yearlyData.find((y) => y.year === previousYear);
      const netFlow = yearData?.netFlow ?? 0;

      if (typeof netFlow !== 'number' || Number.isNaN(netFlow)) {
        return { recorded: false, skipped: true, reason: 'missing_year_net_flow' };
      }

      await this.yearEndBalancePort.saveYearEndBalance(previousYear, netFlow);
      amount = Math.abs(netFlow);
      signIndicator = netFlow >= 0 ? '+' : '-';
    }

    if (amount <= 0) {
      return { recorded: false, skipped: true, reason: 'zero_amount' };
    }

    const description = `Report à nouveau de l'année ${yearDisplay} (${signIndicator})`;

    return this.recordLedgerEntry.execute({
      turn,
      type: 'carry_forward',
      amount,
      description,
      businessKey,
    });
  }
}
