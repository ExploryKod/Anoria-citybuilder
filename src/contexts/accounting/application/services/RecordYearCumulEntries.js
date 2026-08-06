import { buildCumulBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

const CUMUL_SPECS = [
  { cumulType: 'cumul_maintenance', sourceType: 'maintenance', label: 'Cumul Maintenance' },
  { cumulType: 'cumul_construction', sourceType: 'construction', label: 'Cumul Construction' },
  { cumulType: 'cumul_salary', sourceType: 'salary', label: 'Cumul salaires fonctionnaires' },
  {
    cumulType: 'cumul_exceptional_expenses',
    sourceType: 'exceptional_expenses',
    label: 'Cumul Réparations',
  },
  { cumulType: 'cumul_loan_interest', sourceType: 'loan_interest', label: 'Cumul Intérêts Prêt' },
  {
    cumulType: 'cumul_loan_repayment',
    sourceType: 'loan_repayment',
    label: 'Cumul Remboursement Prêt',
  },
];

/**
 * Application service — year-end expense cumul lines (informative, journal only).
 */
export class RecordYearCumulEntries {
  /**
   * @param {import('../commands/journal/RecordLedgerEntry.js').RecordLedgerEntry} recordLedgerEntry
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   */
  constructor(recordLedgerEntry, gameTimePort, journalRepository) {
    this.recordLedgerEntry = recordLedgerEntry;
    this.gameTimePort = gameTimePort;
    this.journalRepository = journalRepository;
  }

  /**
   * @param {object} params
   * @param {number} params.year
   * @param {number} params.turn
   */
  async execute({ year, turn }) {
    if (typeof year !== 'number' || Number.isNaN(year)) {
      return { recorded: 0, skipped: true, reason: 'invalid_year' };
    }

    const entries = await this.journalRepository.getJournalEntries();
    const yearEntries = entries.filter((entry) => {
      const timeInfo = this.gameTimePort.getTimeInfo(entry.turn);
      return timeInfo?.year === year;
    });

    const yearDisplay = year === 0 ? '0 JC' : `${year} ap JC`;
    let recorded = 0;

    for (const spec of CUMUL_SPECS) {
      const total = yearEntries
        .filter((e) => e.type === spec.sourceType)
        .reduce((sum, e) => sum + e.amount, 0);

      if (total <= 0) {
        continue;
      }

      const result = await this.recordLedgerEntry.execute({
        turn,
        type: spec.cumulType,
        amount: total,
        description: `${spec.label} - Année ${yearDisplay}`,
        businessKey: buildCumulBusinessKey(spec.cumulType, year),
      });

      if (result.recorded) {
        recorded += 1;
      }
    }

    return { recorded, skipped: recorded === 0 };
  }
}
