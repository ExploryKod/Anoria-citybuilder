/**
 * Orchestration: monthly commerce supply (factory → barn).
 */
export class RunMonthlyCommerceSupplyCycle {
  /**
   * @param {import('../commands/commerce/TransferFactoryToBarn.js').TransferFactoryToBarn} transferFactoryToBarn
   */
  constructor(transferFactoryToBarn) {
    this.transferFactoryToBarn = transferFactoryToBarn;
    this.lastTransferMonthIndex = -1;
  }

  /**
   * @param {object} params
   * @param {number} params.monthIndex
   * @param {number} [params.time]
   */
  async execute({ monthIndex, time = 0 }) {
    if (this.lastTransferMonthIndex === monthIndex) {
      return { skipped: true };
    }

    this.lastTransferMonthIndex = monthIndex;
    const outcome = await this.transferFactoryToBarn.execute({ time });
    return { skipped: false, ...outcome };
  }

  /** @internal Tests only */
  resetForTests() {
    this.lastTransferMonthIndex = -1;
  }
}
