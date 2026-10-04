/**
 * Query — compare co-maintained treasury with journal-derived balance.
 */
export class GetTreasuryJournalReconciliation {
  /**
   * @param {{ execute: () => Promise<{ funds: number }> }} getTreasurySnapshot
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   */
  constructor(getTreasurySnapshot, journalRepository) {
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.journalRepository = journalRepository;
  }

  /**
   * @param {{ tolerance?: number }} [options]
   * @returns {Promise<{ treasuryFunds: number, journalBalance: number, delta: number, aligned: boolean }>}
   */
  async execute({ tolerance = 0 } = {}) {
    const [treasuryFunds, journalBalance] = await Promise.all([
      this.getTreasurySnapshot.execute().then((snapshot) => snapshot.funds),
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
