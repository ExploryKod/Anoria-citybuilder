/**
 * Query: current treasury balance (HUD): the cash read from the fold of the journal's legs, without reading a line.
 */
export class GetTreasuryBalance {
  /** @param {{ cashOf: () => Promise<number> }} getTreasurySnapshot */
  constructor(getTreasurySnapshot) {
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /** @returns {Promise<number>} */
  async execute() {
    return this.getTreasurySnapshot.cashOf();
  }
}
