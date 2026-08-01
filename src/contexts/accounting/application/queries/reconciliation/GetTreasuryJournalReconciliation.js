/**
 * Query — compare co-maintained treasury with journal-derived balance.
 */
export class GetTreasuryJournalReconciliation {
  /**
   * @param {import('../../ports/TreasuryRepository.js').TreasuryRepository} treasuryRepository
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   */
  constructor(treasuryRepository, journalRepository) {
    this.treasuryRepository = treasuryRepository;
    this.journalRepository = journalRepository;
  }

  /**
   * @param {{ tolerance?: number }} [options]
   * @returns {Promise<{ treasuryFunds: number, journalBalance: number, delta: number, aligned: boolean }>}
   */
  async execute({ tolerance = 0 } = {}) {
    const [treasuryFunds, journalBalance] = await Promise.all([
      this.treasuryRepository.getTreasuryBalance(),
      this.journalRepository.getCurrentBalance(),
    ]);

    const delta = Math.round(treasuryFunds - journalBalance);

    return {
      treasuryFunds: Math.round(treasuryFunds),
      journalBalance: Math.round(journalBalance),
      delta,
      aligned: Math.abs(delta) <= tolerance,
    };
  }
}
