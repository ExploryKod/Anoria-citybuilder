import { buildDepositInterestBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';

/**
 * Application service — once a month, every house with money on deposit earns interest on its balance, paid by
 * the bank that holds it. Run alongside SettleProducerCharges (same day, same turn), but kept separate: this is
 * the bank's own relationship with its depositors, not a goods/service sale to settle through that already large
 * pipeline. Every line is written once per house, per bank, per month: the business key refuses a second charge.
 */
export class SettleBankDepositInterest {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ id: string, type: string }>>} deps.listBuildings the hamlet's buildings, for the description's display names
   * @param {() => Promise<Array<{ houseId: string, bankId: string, balance: number }>>} deps.listDepositBalances every (house, bank) pair with a balance
   * @param {() => number} deps.getDepositInterestRate the fraction of the balance paid per month
   * @param {(buildingType: string) => string | undefined} deps.getBuildingDisplayName the catalog's own name for a building type
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn the lines are dated by
   * @param {number} params.deliveredTime a turn of the month being settled
   */
  async execute({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const rate = this.deps.getDepositInterestRate();
    const balances = await this.deps.listDepositBalances();
    const buildings = await this.deps.listBuildings();
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const nameOf = (buildingId) => {
      const building = buildings.find((candidate) => candidate.id === buildingId);
      const name = building && this.deps.getBuildingDisplayName(building.type);
      if (!name) throw new Error(`[deposit] building ${buildingId} has no catalog name for its journal lines`);
      return name;
    };

    for (const { houseId, bankId, balance } of balances) {
      if (balance <= 0) continue;
      const interest = Math.round(balance * rate * 100) / 100;
      if (interest <= 0) continue;

      const description = `Intérêts d'épargne : ${nameOf(houseId)} à ${nameOf(bankId)} - ${monthLabel}`;

      const houseResult = await this.deps.recordLedgerEntry({
        turn: time,
        type: 'household_deposit_interest',
        amount: interest,
        description,
        businessKey: buildDepositInterestBusinessKey('household_deposit_interest', houseId, bankId, timeInfo.year, timeInfo.monthIndex),
        accountBuildingId: houseId,
        accountKind: 'particulier',
        counterpartyBuildingId: bankId,
      });
      if (!houseResult.recorded && houseResult.reason !== 'duplicate_business_key') {
        throw new Error(`[deposit] the household interest line for ${houseId} was not recorded: ${houseResult.reason}`);
      }

      const bankResult = await this.deps.recordLedgerEntry({
        turn: time,
        type: 'deposit_interest_paid',
        amount: interest,
        description,
        businessKey: buildDepositInterestBusinessKey('deposit_interest_paid', houseId, bankId, timeInfo.year, timeInfo.monthIndex),
        accountBuildingId: bankId,
        counterpartyBuildingId: houseId,
      });
      if (!bankResult.recorded && bankResult.reason !== 'duplicate_business_key') {
        throw new Error(`[deposit] the bank's interest line for ${houseId} was not recorded: ${bankResult.reason}`);
      }
    }
  }
}
