/**
 * Query: current treasury balance (HUD / co-maintained cache).
 */
export class GetTreasuryBalance {
  /** @param {{ execute: () => Promise<{ funds: number }> }} getTreasurySnapshot */
  constructor(getTreasurySnapshot) {
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /** @returns {Promise<number>} */
  async execute() {
    return (await this.getTreasurySnapshot.execute()).funds;
  }
}
