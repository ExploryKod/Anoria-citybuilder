/**
 * Application service — a house moves money into its bank: debited from its personal account, credited to the
 * bank's own account (the bank's cash, and its liability to the house — see DepositBalancePolicy.js for how the
 * house's claim is derived back out of these same lines). Each call creates a distinct pair of ledger lines (no
 * businessKey — a deposit is a one-off player action, like a construction expense, not a recurring monthly
 * charge; see RecordConstructionExpense.js).
 */
export class RecordHouseholdDeposit {
  /**
   * @param {object} deps
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   * @param {(houseId: string) => Promise<number>} deps.fundsOf what the house has in its personal account right now
   */
  constructor({ recordLedgerEntry, fundsOf }) {
    this.deps = { recordLedgerEntry, fundsOf };
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {string} params.houseId
   * @param {string} params.bankId
   * @param {number} params.amount
   * @param {string} params.description
   * @returns {Promise<{ recorded: boolean, skipped: boolean, reason?: string }>}
   */
  async execute({ turn, houseId, bankId, amount, description }) {
    if (!houseId) throw new Error('[deposit] a deposit needs its house');
    if (!bankId) throw new Error('[deposit] a deposit needs its bank');
    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return { recorded: false, skipped: true, reason: 'zero_amount' };
    }

    const funds = await this.deps.fundsOf(houseId);
    if (funds < roundedAmount) {
      return { recorded: false, skipped: true, reason: 'insufficient_funds' };
    }

    const houseResult = await this.deps.recordLedgerEntry({
      turn,
      type: 'deposit',
      amount: roundedAmount,
      description,
      accountBuildingId: houseId,
      accountKind: 'particulier',
      counterpartyBuildingId: bankId,
    });
    if (!houseResult.recorded) {
      return { recorded: false, skipped: true, reason: houseResult.reason };
    }

    const bankResult = await this.deps.recordLedgerEntry({
      turn,
      type: 'deposit_received',
      amount: roundedAmount,
      description,
      accountBuildingId: bankId,
      counterpartyBuildingId: houseId,
    });
    if (!bankResult.recorded) {
      throw new Error(`[deposit] the bank's receiving line for ${houseId} was not recorded: ${bankResult.reason}`);
    }

    return { recorded: true, skipped: false };
  }
}
