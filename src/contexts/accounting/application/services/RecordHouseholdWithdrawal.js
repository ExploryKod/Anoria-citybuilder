/**
 * Application service — a house takes money back out of its bank: credited to its personal account, debited from
 * the bank's own account. Refused (not thrown) when the house asks for more than it actually has on deposit, or
 * when the bank's own cash can't cover it — a bank that lent most of its deposits out as loans can genuinely run
 * short, the same scoped, visible insolvency as a loan request the bank can't fund (see PretsPanel.js). Each call
 * creates a distinct pair of ledger lines (no businessKey — a one-off player action, not a recurring charge).
 */
export class RecordHouseholdWithdrawal {
  /**
   * @param {object} deps
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   * @param {(houseId: string, bankId: string) => Promise<number>} deps.depositBalanceOf what the house has on deposit at this bank
   * @param {(bankId: string) => Promise<number>} deps.fundsOf what the bank has in its own account right now
   */
  constructor({ recordLedgerEntry, depositBalanceOf, fundsOf }) {
    this.deps = { recordLedgerEntry, depositBalanceOf, fundsOf };
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
    if (!houseId) throw new Error('[withdrawal] a withdrawal needs its house');
    if (!bankId) throw new Error('[withdrawal] a withdrawal needs its bank');
    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return { recorded: false, skipped: true, reason: 'zero_amount' };
    }

    const deposited = await this.deps.depositBalanceOf(houseId, bankId);
    if (deposited < roundedAmount) {
      return { recorded: false, skipped: true, reason: 'insufficient_deposit' };
    }

    const bankFunds = await this.deps.fundsOf(bankId);
    if (bankFunds < roundedAmount) {
      return { recorded: false, skipped: true, reason: 'bank_insufficient_funds' };
    }

    const houseResult = await this.deps.recordLedgerEntry({
      turn,
      type: 'withdrawal',
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
      type: 'withdrawal_paid',
      amount: roundedAmount,
      description,
      accountBuildingId: bankId,
      counterpartyBuildingId: houseId,
    });
    if (!bankResult.recorded) {
      throw new Error(`[withdrawal] the bank's paying line for ${houseId} was not recorded: ${bankResult.reason}`);
    }

    return { recorded: true, skipped: false };
  }
}
