/**
 * Query: current treasury balance (HUD / co-maintained cache).
 */
export class GetTreasuryBalance {
  /** @param {import('../../ports/TreasuryRepository.js').TreasuryRepository} treasuryRepository */
  constructor(treasuryRepository) {
    this.treasuryRepository = treasuryRepository;
  }

  /** @returns {Promise<number>} */
  async execute() {
    return this.treasuryRepository.getTreasuryBalance();
  }
}
