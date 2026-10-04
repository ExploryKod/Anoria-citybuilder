/**
 * Port: the treasury row (`budget_current`): turn and non-money state only. Money is derived from the journal.
 */
export class TreasuryRepository {
  /** @returns {Promise<object|null>} */
  async getRawBudgetRow() {
    throw new Error('TreasuryRepository: port not implemented');
  }
}
